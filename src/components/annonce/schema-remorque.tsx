import { getFormatter, getTranslations } from "next-intl/server";

import {
  positionsRoues,
  vueDeCote,
  vueDeDessus,
  type Dimensions,
  type Vue,
} from "@/domain/annonce/schema-dimensions";

/**
 * Schéma coté d'une remorque, dessiné depuis ses propres dimensions.
 *
 * Rien n'est demandé au propriétaire : les mesures sont celles qu'il a déjà
 * saisies à l'étape des caractéristiques, et le dessin ne peut donc pas
 * contredire l'annonce. Il est produit sur le serveur, en vectoriel, sans une
 * ligne de JavaScript envoyée au navigateur — quelques centaines d'octets, net
 * à toute taille, lisible par les moteurs.
 *
 * Les deux vues sont montrées **côte à côte plutôt que derrière une bascule**.
 * Une bascule économise de la place au prix d'un clic et d'un état à gérer ;
 * ici les deux dessins sont petits, complémentaires, et se lisent ensemble —
 * la longueur se retrouve sur les deux et fait le lien.
 *
 * La vue de côté disparaît quand la hauteur est inconnue, ce qui est le cas de
 * tous les plateaux. Un plateau n'a pas de ridelle : lui en dessiner une pour
 * remplir la case serait faire dire au schéma ce que l'annonce ne dit pas.
 */
export async function SchemaRemorque({
  dimensions,
}: {
  dimensions: Dimensions;
}) {
  const t = await getTranslations("annonce.schema");
  const format = await getFormatter();

  const dessus = vueDeDessus(dimensions);
  const cote = vueDeCote(dimensions);

  /** Les millimètres se disent en centimètres : c'est l'ordre de grandeur. */
  const mesure = (mm: number) =>
    t("centimetres", {
      valeur: format.number(mm / 10, { maximumFractionDigits: 0 }),
    });

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{t("titre")}</h2>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-texte-attenue">
        {t("chapo")}
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <figure className="rounded-carte border border-bordure bg-fond-eleve p-5">
          <figcaption className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
            {t("dessus")}
          </figcaption>
          <div className="mt-4">
            <DessinDessus vue={dessus} legende={t("alternativeDessus")} />
          </div>
          <dl className="mt-4 space-y-1 text-sm">
            <Cote repere="A" libelle={t("longueur")} valeur={mesure(dimensions.longueurMm)} />
            <Cote repere="B" libelle={t("largeur")} valeur={mesure(dimensions.largeurMm)} />
          </dl>
        </figure>

        {cote ? (
          <figure className="rounded-carte border border-bordure bg-fond-eleve p-5">
            <figcaption className="text-[0.6875rem] font-semibold tracking-[0.14em] text-texte-attenue uppercase">
              {t("cote")}
            </figcaption>
            <div className="mt-4">
              <DessinCote
                vue={cote}
                essieux={dimensions.nombreEssieux}
                legende={t("alternativeCote")}
              />
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <Cote repere="A" libelle={t("longueur")} valeur={mesure(dimensions.longueurMm)} />
              <Cote
                repere="C"
                libelle={t("hauteur")}
                valeur={mesure(dimensions.hauteurMm as number)}
              />
            </dl>
          </figure>
        ) : (
          <div className="flex items-center rounded-carte border border-dashed border-bordure bg-fond-doux p-5">
            <p className="text-[0.9375rem] text-texte-attenue">
              {t("sansHauteur")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Une ligne de cote, sous le dessin. */
function Cote({
  repere,
  libelle,
  valeur,
}: {
  repere: string;
  libelle: string;
  valeur: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="flex items-center gap-2 text-texte-attenue">
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full bg-accent text-[0.6875rem] font-bold text-accent-contraste"
        >
          {repere}
        </span>
        {libelle}
      </dt>
      <dd className="ml-auto font-medium tabular-nums">{valeur}</dd>
    </div>
  );
}

const TRAIT = "var(--bordure)";
const CORPS = "var(--fond-doux)";
const ACCENT = "var(--accent)";

function DessinDessus({ vue, legende }: { vue: Vue; legende: string }) {
  const { corps } = vue;
  const basCote = corps.y + corps.hauteur + 16;

  return (
    <svg
      viewBox={`0 0 ${vue.largeurVue} ${vue.hauteurVue}`}
      role="img"
      aria-label={legende}
      className="h-auto w-full"
    >
      {/* Timon : le triangle qui va vers la boule d'attelage. */}
      <path
        d={`M ${corps.x} ${corps.y + corps.hauteur * 0.35}
            L ${corps.x - 30} ${corps.y + corps.hauteur / 2}
            L ${corps.x} ${corps.y + corps.hauteur * 0.65}`}
        fill="none"
        stroke={TRAIT}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <circle
        cx={corps.x - 34}
        cy={corps.y + corps.hauteur / 2}
        r={5}
        fill="none"
        stroke={TRAIT}
        strokeWidth={3}
      />

      <rect
        x={corps.x}
        y={corps.y}
        width={corps.largeur}
        height={corps.hauteur}
        rx={4}
        fill={CORPS}
        stroke={TRAIT}
        strokeWidth={2}
      />

      {/* Cote A — longueur, sous la caisse. */}
      <Fleche
        de={[corps.x, basCote]}
        vers={[corps.x + corps.largeur, basCote]}
        repere="A"
      />

      {/* Cote B — largeur, sur le flanc droit. */}
      <Fleche
        de={[corps.x + corps.largeur + 16, corps.y]}
        vers={[corps.x + corps.largeur + 16, corps.y + corps.hauteur]}
        repere="B"
      />
    </svg>
  );
}

function DessinCote({
  vue,
  essieux,
  legende,
}: {
  vue: Vue;
  essieux: number;
  legende: string;
}) {
  const { corps } = vue;
  const sol = corps.y + corps.hauteur + 14;
  const rayon = 9;

  return (
    <svg
      viewBox={`0 0 ${vue.largeurVue} ${vue.hauteurVue}`}
      role="img"
      aria-label={legende}
      className="h-auto w-full"
    >
      <line
        x1={corps.x - 40}
        y1={sol + rayon}
        x2={corps.x + corps.largeur + 10}
        y2={sol + rayon}
        stroke={TRAIT}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />

      <path
        d={`M ${corps.x} ${corps.y + corps.hauteur - 6}
            L ${corps.x - 34} ${corps.y + corps.hauteur - 6}`}
        stroke={TRAIT}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle
        cx={corps.x - 38}
        cy={corps.y + corps.hauteur - 6}
        r={5}
        fill="none"
        stroke={TRAIT}
        strokeWidth={3}
      />

      <rect
        x={corps.x}
        y={corps.y}
        width={corps.largeur}
        height={corps.hauteur}
        rx={4}
        fill={CORPS}
        stroke={TRAIT}
        strokeWidth={2}
      />

      {positionsRoues(essieux).map((position) => (
        <circle
          key={position}
          cx={corps.x + corps.largeur * position}
          cy={sol}
          r={rayon}
          fill={CORPS}
          stroke={TRAIT}
          strokeWidth={2.5}
        />
      ))}

      <Fleche
        de={[corps.x + corps.largeur + 16, corps.y]}
        vers={[corps.x + corps.largeur + 16, corps.y + corps.hauteur]}
        repere="C"
      />
    </svg>
  );
}

/** Flèche cotée, horizontale ou verticale, avec son repère au milieu. */
function Fleche({
  de,
  vers,
  repere,
}: {
  de: [number, number];
  vers: [number, number];
  repere: string;
}) {
  const [x1, y1] = de;
  const [x2, y2] = vers;
  const milieuX = (x1 + x2) / 2;
  const milieuY = (y1 + y2) / 2;
  const horizontale = y1 === y2;

  const embout = (x: number, y: number, sens: number) =>
    horizontale
      ? `M ${x + 6 * sens} ${y - 4} L ${x} ${y} L ${x + 6 * sens} ${y + 4}`
      : `M ${x - 4} ${y + 6 * sens} L ${x} ${y} L ${x + 4} ${y + 6 * sens}`;

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth={1.5} />
      <path d={embout(x1, y1, 1)} fill="none" stroke={ACCENT} strokeWidth={1.5} />
      <path d={embout(x2, y2, -1)} fill="none" stroke={ACCENT} strokeWidth={1.5} />
      <circle cx={milieuX} cy={milieuY} r={8} fill={ACCENT} />
      <text
        x={milieuX}
        y={milieuY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="var(--accent-contraste)"
      >
        {repere}
      </text>
    </g>
  );
}
