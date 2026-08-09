import { afterAll, describe, expect, it } from "vitest";

import { and, asc, eq, inArray, isNotNull, isNull, like } from "drizzle-orm";

import { db } from "@/server/db";
import { ticketMessage, ticketSupport, utilisateur } from "@/server/db/schema";

/**
 * Le parcours d'une demande d'assistance, éprouvé sur la base.
 *
 * Les actions serveur exigent une session — elles lisent le compte connecté
 * dans les entêtes de la requête, ce qu'un test hors requête ne fournit pas.
 * Ces tests portent donc sur ce que la base doit garantir quoi qu'il arrive :
 * l'ordre du fil, la séparation des notes internes, et l'invariant qui
 * justifie tout le module — aucune demande close sans réponse.
 */

const creees: string[] = [];

/** Préfixe reconnaissable : la purge et les invariants s'y accrochent. */
const PREFIXE = "AS-ESSAI-";

async function compteDessai() {
  const [ligne] = await db
    .select({ id: utilisateur.id, email: utilisateur.email })
    .from(utilisateur)
    .where(eq(utilisateur.email, "moi@demonstration.flexitrailer.eu"))
    .limit(1);
  return ligne;
}

async function deposer(entree: {
  sujet: string;
  priorite: "basse" | "normale" | "haute";
}) {
  const demandeur = await compteDessai();
  const corps = `Message d'ouverture — ${entree.sujet}`;

  const [ligne] = await db
    .insert(ticketSupport)
    .values({
      reference: `${PREFIXE}${creees.length + 1}`,
      demandeurId: demandeur.id,
      demandeurEmail: demandeur.email,
      sujet: entree.sujet,
      message: corps,
      canal: "formulaire",
      priorite: entree.priorite,
      statut: "ouvert",
    })
    .returning({ id: ticketSupport.id });

  creees.push(ligne.id);

  await db.insert(ticketMessage).values({
    ticketId: ligne.id,
    auteurId: demandeur.id,
    auteurRole: "demandeur",
    corps,
  });

  return ligne.id;
}

afterAll(async () => {
  if (creees.length === 0) return;
  // La clé étrangère est en cascade, mais supprimer le fil explicitement rend
  // la dépendance visible plutôt que devinée.
  await db.delete(ticketMessage).where(inArray(ticketMessage.ticketId, creees));
  await db.delete(ticketSupport).where(inArray(ticketSupport.id, creees));
});

describe("demande d'assistance — le fil", () => {
  it("garde le message d'ouverture en tête", async () => {
    const id = await deposer({ sujet: "Le timon grince au freinage", priorite: "normale" });

    await db.insert(ticketMessage).values({
      ticketId: id,
      auteurRole: "assistance",
      corps: "Bonjour, pouvez-vous préciser depuis quand ?",
    });

    const fil = await db
      .select({ role: ticketMessage.auteurRole, corps: ticketMessage.corps })
      .from(ticketMessage)
      .where(eq(ticketMessage.ticketId, id))
      .orderBy(asc(ticketMessage.creeLe));

    // Un échange qui commencerait par une réponse serait illisible.
    expect(fil).toHaveLength(2);
    expect(fil[0].role).toBe("demandeur");
    expect(fil[0].corps).toMatch(/ouverture/);
    expect(fil[1].role).toBe("assistance");
  });

  it("marque la note interne, et elle seule", async () => {
    const id = await deposer({ sujet: "Question de facturation", priorite: "basse" });

    await db.insert(ticketMessage).values([
      {
        ticketId: id,
        auteurRole: "assistance",
        corps: "Vérifier le barème du pays avant de répondre.",
        interne: true,
      },
      {
        ticketId: id,
        auteurRole: "assistance",
        corps: "Bonjour, voici le détail de votre facture.",
      },
    ]);

    const visiblesParLeDemandeur = await db
      .select({ corps: ticketMessage.corps })
      .from(ticketMessage)
      .where(and(eq(ticketMessage.ticketId, id), eq(ticketMessage.interne, false)));

    // Le demandeur voit son message et la réponse — jamais la note de dossier.
    expect(visiblesParLeDemandeur).toHaveLength(2);
    expect(visiblesParLeDemandeur.map((ligne) => ligne.corps).join(" ")).not.toMatch(
      /barème du pays/,
    );
  });
});

describe("demande d'assistance — l'engagement de réponse", () => {
  it("naît sans date de première réponse ni de clôture", async () => {
    const id = await deposer({
      sujet: "Une remorque passe-t-elle sous un porche ?",
      priorite: "basse",
    });

    const [ligne] = await db
      .select({
        statut: ticketSupport.statut,
        premiereReponseLe: ticketSupport.premiereReponseLe,
        resoluLe: ticketSupport.resoluLe,
        assigneAId: ticketSupport.assigneAId,
      })
      .from(ticketSupport)
      .where(eq(ticketSupport.id, id));

    expect(ligne.statut).toBe("ouvert");
    expect(ligne.premiereReponseLe).toBeNull();
    expect(ligne.resoluLe).toBeNull();
    expect(ligne.assigneAId).toBeNull();
  });

  it("ne close aucune demande prise en charge sans que la réponse soit datée", async () => {
    // L'invariant qui justifie le module — avec la seule exception qui a un
    // sens : le demandeur qui **retire** sa demande la clôt sans réponse, et
    // c'est très bien ainsi. Ces dossiers-là n'ont jamais été pris en charge,
    // donc `assigne_a_id` est vide : c'est ce qui les distingue d'une clôture
    // par l'assistance, la seule que la promesse engage.
    //
    // L'invariant ne porte que sur les dossiers nés du code applicatif :
    // l'amorçage écrit des états directement, sans passer par la machine, et
    // vérifier son jeu d'essai reviendrait à tester le script plutôt que la
    // règle.
    const orphelines = await db
      .select({ reference: ticketSupport.reference })
      .from(ticketSupport)
      .where(
        and(
          eq(ticketSupport.statut, "resolu"),
          isNull(ticketSupport.premiereReponseLe),
          isNotNull(ticketSupport.assigneAId),
          like(ticketSupport.reference, "AS-2%"),
        ),
      );

    expect(orphelines.map((ligne) => ligne.reference)).toEqual([]);
  });

  it("ne date pas une clôture sur une demande encore ouverte", async () => {
    const incoherentes = await db
      .select({ reference: ticketSupport.reference })
      .from(ticketSupport)
      .where(and(eq(ticketSupport.statut, "ouvert"), isNull(ticketSupport.resoluLe)));

    const toutesOuvertes = await db
      .select({ reference: ticketSupport.reference })
      .from(ticketSupport)
      .where(eq(ticketSupport.statut, "ouvert"));

    // Toute demande ouverte est sans date de clôture : les deux comptes se
    // rejoignent, sans quoi une demande afficherait « en attente » et « close
    // le … » à la fois.
    expect(incoherentes.length).toBe(toutesOuvertes.length);
  });
});
