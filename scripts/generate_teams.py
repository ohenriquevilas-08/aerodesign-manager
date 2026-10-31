# Gera src/sim/content/teams.ts a partir do Apêndice A de docs/design/ano-1.md.
# Uso: py scripts/generate_teams.py
import re, json, sys, unicodedata
from pathlib import Path
root = Path(__file__).resolve().parent.parent
doc = (root / "docs/design/ano-1.md").read_text(encoding="utf-8")
section = doc.split("## Apêndice A")[1]
archetypes = {
    "EESC-UESP Alfa": "tradicional",
    "Uai, Sô! Voa!!! AeroDesign": "carga",
    "Keep Climbing": "relatorio",
    "Monteverde": "tecnica",
    "Gigazord AeroDesign": "novata",
}
foreign = {"México", "Polônia"}
rows = []
for line in section.splitlines():
    m = re.match(r"\|\s*(\d+)\s*\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|\s*$", line)
    if not m: continue
    num, name, inst, place, _ = [x.strip() for x in m.groups()]
    am = re.match(r"(.+)\(([^()]+)\)\s*$", inst)
    institution, acronym = (am.group(1).strip(), am.group(2).strip()) if am else (inst, inst)
    city, state = [x.strip() for x in place.split("/")]
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower()).encode("ascii","ignore").decode()).strip("-")
    rows.append(dict(id=slug, name=name, institution=institution, acronym=acronym, city=city, state=state,
                     archetype=archetypes.get(name), foreign=state in foreign))
assert rows, "Apêndice A sem equipes"
assert len({r["id"] for r in rows}) == len(rows), "ids duplicados"
assert all(a in [r["name"] for r in rows] for a in archetypes)
body = ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows)
out = f'''// Gerado a partir de docs/design/ano-1.md (Apêndice A). Paródias das equipes reais;
// instituições fictícias, cidades reais. Para editar, mude o design doc e rode `py scripts/generate_teams.py`.

export interface TeamSeed {{
  id: string;
  name: string;
  institution: string;
  acronym: string;
  city: string;
  state: string;
  /** Arquétipo das rivais de destaque (design §2.1). */
  archetype: "tradicional" | "carga" | "relatorio" | "tecnica" | "novata" | null;
  /** Equipes estrangeiras ficam fora do campo no Ano 1. */
  foreign: boolean;
}}

export const TEAM_POOL: readonly TeamSeed[] = [
{body}
];
'''
(root / "src/sim/content/teams.ts").write_text(out, encoding="utf-8")
print(len(rows), "teams written")
