// Gerado a partir de docs/design/ano-1.md (Apêndice A). Paródias das equipes reais;
// instituições fictícias, cidades reais. Para editar, mude o design doc e rode `py scripts/generate_teams.py`.

export interface TeamSeed {
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
}

export const TEAM_POOL: readonly TeamSeed[] = [
  {"id": "eesc-uesp-alfa", "name": "EESC-UESP Alfa", "institution": "Universidade Estadual de São Paulo – Escola de Engenharia de São Carlos", "acronym": "EESC-UESP", "city": "São Carlos", "state": "SP", "archetype": "tradicional", "foreign": false},
  {"id": "axe-voa", "name": "Axé Voa", "institution": "Universidade Federal de Salvador", "acronym": "UFSal", "city": "Salvador", "state": "BA", "archetype": null, "foreign": false},
  {"id": "uirai-aerodesign", "name": "Uiraí AeroDesign", "institution": "Instituto Federal de Engenharia de Itajubá", "acronym": "IFEI", "city": "Itajubá", "state": "MG", "archetype": null, "foreign": false},
  {"id": "uai-so-voa-aerodesign", "name": "Uai, Sô! Voa!!! AeroDesign", "institution": "Universidade Federal das Gerais", "acronym": "UFGe", "city": "Belo Horizonte", "state": "MG", "archetype": "carga", "foreign": false},
  {"id": "aerofegu", "name": "AeroFEGu", "institution": "Universidade Estadual Paulista Prof. Mesquita – Fac. de Eng. de Guaratinguetá", "acronym": "FEG-UEPM", "city": "Guaratinguetá", "state": "SP", "archetype": null, "foreign": false},
  {"id": "keep-climbing", "name": "Keep Climbing", "institution": "Universidade Estadual de São Paulo – Escola Politécnica", "acronym": "Poli-UESP", "city": "São Paulo", "state": "SP", "archetype": "relatorio", "foreign": false},
  {"id": "monteverde", "name": "Monteverde", "institution": "Instituto Técnico de Aeronáutica", "acronym": "ITAe", "city": "São José dos Campos", "state": "SP", "archetype": "tecnica", "foreign": false},
  {"id": "tucanucu", "name": "Tucanuçu", "institution": "Universidade Federal do Triângulo", "acronym": "UFTri", "city": "Uberlândia", "state": "MG", "archetype": null, "foreign": false},
  {"id": "hawks-aerodesign", "name": "Hawks AeroDesign", "institution": "Centro Universitário de Sorocaba", "acronym": "CEUSO", "city": "Sorocaba", "state": "SP", "archetype": null, "foreign": false},
  {"id": "cefeta-aerodesign", "name": "CEFETA AeroDesign", "institution": "Centro Federal de Tecnologia de Minas", "acronym": "CEFTEM", "city": "Belo Horizonte", "state": "MG", "archetype": null, "foreign": false},
  {"id": "f-carrancudo", "name": "F-Carrancudo", "institution": "Universidade Federal do Velho Chico", "acronym": "UFVC", "city": "Juazeiro", "state": "BA", "archetype": null, "foreign": false},
  {"id": "aerotambau", "name": "AeroTambaú", "institution": "Universidade Federal Paraibana", "acronym": "UFPb", "city": "João Pessoa", "state": "PB", "archetype": null, "foreign": false},
  {"id": "gigazord-aerodesign", "name": "Gigazord AeroDesign", "institution": "Faculdade Tecnológica de São José dos Campos", "acronym": "FATESJ", "city": "São José dos Campos", "state": "SP", "archetype": "novata", "foreign": false},
  {"id": "harpia-real-aerodesign", "name": "Harpia-Real AeroDesign", "institution": "Universidade Federal do Grande ABC", "acronym": "UFGABC", "city": "Santo André", "state": "SP", "archetype": null, "foreign": false},
  {"id": "carcaras-aerodesign", "name": "Carcarás AeroDesign", "institution": "Universidade Campineira de Engenharia", "acronym": "UCE", "city": "Campinas", "state": "SP", "archetype": null, "foreign": false},
  {"id": "utfalcao-aerodesign", "name": "UTFalcão AeroDesign", "institution": "Universidade Tecnológica do Paraná – Ponta Grossa", "acronym": "UTPR", "city": "Ponta Grossa", "state": "PR", "archetype": null, "foreign": false},
  {"id": "falcao-prateado-aerodesign", "name": "Falcão Prateado Aerodesign", "institution": "Centro Universitário de Araras", "acronym": "UniAraras", "city": "Araras", "state": "SP", "archetype": null, "foreign": false},
  {"id": "fea-regular", "name": "FEA Regular", "institution": "Centro Universitário de Engenharia do ABC", "acronym": "CUEA", "city": "São Bernardo do Campo", "state": "SP", "archetype": null, "foreign": false},
  {"id": "aeroescorpiao-ifp-araraquara", "name": "AeroEscorpião IFP Araraquara", "institution": "Instituto Federal Paulista – Araraquara", "acronym": "IFP", "city": "Araraquara", "state": "SP", "archetype": null, "foreign": false},
  {"id": "nexus-aerodesign", "name": "Nexus AeroDesign", "institution": "Universidade Federal Catarinense – Joinville", "acronym": "UFCat", "city": "Joinville", "state": "SC", "archetype": null, "foreign": false},
  {"id": "atena-aerodesign", "name": "Atena AeroDesign", "institution": "Universidade Federal da Guanabara – Escola Politécnica", "acronym": "Poli-UFGB", "city": "Rio de Janeiro", "state": "RJ", "archetype": null, "foreign": false},
  {"id": "skyward-ufvoo", "name": "Skyward UFVôo", "institution": "Universidade Federal da Zona da Mata", "acronym": "UFZM", "city": "Viçosa", "state": "MG", "archetype": null, "foreign": false},
  {"id": "condores-aerodesign", "name": "Condores AeroDesign", "institution": "Universidade Tecnológica do Paraná – Cornélio Procópio", "acronym": "UTPR", "city": "Cornélio Procópio", "state": "PR", "archetype": null, "foreign": false},
  {"id": "atalantida", "name": "Atalântida", "institution": "Universidade Tecnológica do Paraná – Curitiba", "acronym": "UTPR", "city": "Curitiba", "state": "PR", "archetype": null, "foreign": false},
  {"id": "redbird-aerodesign", "name": "RedBird AeroDesign", "institution": "Universidade Federal de Niterói", "acronym": "UFNit", "city": "Niterói", "state": "RJ", "archetype": null, "foreign": false},
  {"id": "ocapi", "name": "Ocapi", "institution": "Universidade Estadual Paulista Prof. Mesquita – Fac. de Eng. de Ilha Solteira", "acronym": "FEIS-UEPM", "city": "Ilha Solteira", "state": "SP", "archetype": null, "foreign": false},
  {"id": "flaming-duck", "name": "Flaming Duck", "institution": "Universidade Federal de Curitiba", "acronym": "UFCuri", "city": "Curitiba", "state": "PR", "archetype": null, "foreign": false},
  {"id": "hipogrifo-aerodesign", "name": "Hipogrifo AeroDesign", "institution": "Universidade Tecnológica do Paraná – Londrina", "acronym": "UTPR", "city": "Londrina", "state": "PR", "archetype": null, "foreign": false},
  {"id": "u-vuela-aerodesign", "name": "U-Vuela AeroDesign", "institution": "Universidad Aeronáutica del Bajío", "acronym": "UNAB", "city": "Querétaro", "state": "México", "archetype": null, "foreign": true},
  {"id": "dragao-dourado-aerodesign", "name": "Dragão Dourado AeroDesign", "institution": "Universidade Federal do Centro Paulista", "acronym": "UFCP", "city": "São Carlos", "state": "SP", "archetype": null, "foreign": false},
  {"id": "apolo", "name": "Apolo", "institution": "Universidade Estadual Maranhense", "acronym": "UEMar", "city": "São Luís", "state": "MA", "archetype": null, "foreign": false},
  {"id": "delta-do-parnaiba-aerodesign", "name": "Delta do Parnaíba AeroDesign", "institution": "Universidade Federal de Teresina", "acronym": "UFTer", "city": "Teresina", "state": "PI", "archetype": null, "foreign": false},
  {"id": "pegasertao-aerodesign", "name": "PégaSertão AeroDesign", "institution": "Universidade Federal Rural do Sertão – Mossoró", "acronym": "UFRuS", "city": "Mossoró", "state": "RN", "archetype": null, "foreign": false},
  {"id": "aerogauderio-upg", "name": "AeroGaudério UPG", "institution": "Universidade do Planalto Gaúcho", "acronym": "UPG", "city": "Passo Fundo", "state": "RS", "archetype": null, "foreign": false},
  {"id": "jacutinga-aerodesign", "name": "Jacutinga AeroDesign", "institution": "Universidade Federal do Pantanal Sul", "acronym": "UFPS", "city": "Dourados", "state": "MS", "archetype": null, "foreign": false},
  {"id": "losango-aereo-aerodesign", "name": "Losango Aéreo AeroDesign", "institution": "Universidade Federal do Triângulo de Minas", "acronym": "UFTMi", "city": "Uberaba", "state": "MG", "archetype": null, "foreign": false},
  {"id": "draco-alatus", "name": "Draco Alatus", "institution": "Universidade do Planalto Central – Faculdade de Tecnologia", "acronym": "FT-UPC", "city": "Brasília", "state": "DF", "archetype": null, "foreign": false},
  {"id": "coxilha-aerodesign", "name": "Coxilha AeroDesign", "institution": "Universidade Federal Gaúcha", "acronym": "UFGa", "city": "Porto Alegre", "state": "RS", "archetype": null, "foreign": false},
  {"id": "aeroaraucaria-ucp", "name": "Aeroaraucária UCP", "institution": "Universidade Católica Paranaense", "acronym": "UCP", "city": "Curitiba", "state": "PR", "archetype": null, "foreign": false},
  {"id": "eva-aerodesign", "name": "EVA AeroDesign", "institution": "Universidade Estadual Maringaense", "acronym": "UEMg", "city": "Maringá", "state": "PR", "archetype": null, "foreign": false},
  {"id": "voyager", "name": "Voyager", "institution": "Universidade Joseense do Vale", "acronym": "UJV", "city": "São José dos Campos", "state": "SP", "archetype": null, "foreign": false},
  {"id": "jandaia-aerodesign", "name": "Jandaia AeroDesign", "institution": "Universidade Federal Cearense – Russas", "acronym": "UFCe", "city": "Russas", "state": "CE", "archetype": null, "foreign": false},
  {"id": "buteo-aerodesign", "name": "Buteo Aerodesign", "institution": "Instituto Federal Paulista – São Carlos", "acronym": "IFP", "city": "São Carlos", "state": "SP", "archetype": null, "foreign": false},
  {"id": "aeroduque", "name": "AeroDuque", "institution": "Centro Universitário Morumbi Paulistano", "acronym": "CUMP", "city": "São Paulo", "state": "SP", "archetype": null, "foreign": false},
  {"id": "pteranodon-aerodesign", "name": "Pteranodon AeroDesign", "institution": "Universidade Federal do Cerrado", "acronym": "UFCer", "city": "Goiânia", "state": "GO", "archetype": null, "foreign": false},
  {"id": "epar-aerodesign", "name": "EPAR AeroDesign", "institution": "Universidade Tecnológica do Paraná – Pato Branco", "acronym": "UTPR", "city": "Pato Branco", "state": "PR", "archetype": null, "foreign": false},
  {"id": "skyfleet", "name": "Skyfleet", "institution": "Centro Universitário ENIEC", "acronym": "ENIEC", "city": "Guarulhos", "state": "SP", "archetype": null, "foreign": false},
  {"id": "ima-aerodesign", "name": "IMA Aerodesign", "institution": "Instituto Mário de Tecnologia", "acronym": "IMA", "city": "São Caetano do Sul", "state": "SP", "archetype": null, "foreign": false},
  {"id": "aeroserra", "name": "AeroSerra", "institution": "Universidade da Serra Gaúcha", "acronym": "USG", "city": "Caxias do Sul", "state": "RS", "archetype": null, "foreign": false},
  {"id": "aura-caelique-generosa", "name": "AURA CAELIQUE GENEROSA", "institution": "Centro Universitário ETAP", "acronym": "ETAP", "city": "São José dos Campos", "state": "SP", "archetype": null, "foreign": false},
  {"id": "arribaca-aeromec-aerodesign", "name": "Arribaçã Aeromec Aerodesign", "institution": "Universidade Federal Cearense – Fortaleza", "acronym": "UFCe", "city": "Fortaleza", "state": "CE", "archetype": null, "foreign": false},
  {"id": "fama-aerodesign", "name": "FAMA Aerodesign", "institution": "Instituto Federal Capixaba – São Mateus", "acronym": "IFCap", "city": "São Mateus", "state": "ES", "archetype": null, "foreign": false},
  {"id": "borboremasas-aerodesign", "name": "Borboremasas Aerodesign", "institution": "Universidade Federal da Borborema", "acronym": "UFBor", "city": "Campina Grande", "state": "PB", "archetype": null, "foreign": false},
  {"id": "japiim-aerodesign", "name": "Japiim AeroDesign", "institution": "Universidade Federal Amazônica do Pará", "acronym": "UFAmP", "city": "Belém", "state": "PA", "archetype": null, "foreign": false},
  {"id": "white-stork", "name": "White Stork", "institution": "Politechnika Wielkopolska", "acronym": "fictícia", "city": "Poznań", "state": "Polônia", "archetype": null, "foreign": true},
  {"id": "maritaca-aerodesign", "name": "Maritaca Aerodesign", "institution": "Instituto Federal Cearense – Maracanaú", "acronym": "IFCe", "city": "Maracanaú", "state": "CE", "archetype": null, "foreign": false},
  {"id": "aeroinspire", "name": "AeroInspire", "institution": "Inspire – Instituto de Ensino Superior", "acronym": "Inspire – Instituto de Ensino Superior", "city": "São Paulo", "state": "SP", "archetype": null, "foreign": false},
  {"id": "suzanaero", "name": "SuzanAERO", "institution": "Instituto Federal Paulista – Suzano", "acronym": "IFP", "city": "Suzano", "state": "SP", "archetype": null, "foreign": false},
  {"id": "quetzalcoatl-aerodesign", "name": "Quetzalcóatl AeroDesign", "institution": "Instituto Politécnico Mexicano – Ticomán", "acronym": "IPM", "city": "Cidade do México", "state": "México", "archetype": null, "foreign": true},
  {"id": "ivoa-aerodesign", "name": "IVoa AeroDesign", "institution": "Instituto Federal da Zona da Mata Mineira – Juiz de Fora", "acronym": "IFZM", "city": "Juiz de Fora", "state": "MG", "archetype": null, "foreign": false},
  {"id": "ararajubas-aerodesign", "name": "Ararajubas AeroDesign", "institution": "Universidade Federal Sergipana", "acronym": "UFSe", "city": "Aracaju", "state": "SE", "archetype": null, "foreign": false}
];
