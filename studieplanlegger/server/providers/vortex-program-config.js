export const vortexProgramInstitutions = Object.freeze({
  himolde: Object.freeze({
    origin: 'https://www.himolde.no',
    catalogueUrl: 'https://www.himolde.no/studier/programmer/',
    university: 'Høgskolen i Molde',
    programmePath: /^\/studier\/programmer\/([^/]+)\/?(?:index\.html)?$/i,
    planPath: /^\/studier\/programmer\/([^/]+)\/studieplaner\/([^/]+\.html)$/i,
    coursePaths: [/^\/studier\/emner\/(?:[^/]+\/)*[^/]+\.html$/i, /^\/english\/studies\/courses\/(?:[^/]+\/)*[^/]+\.html$/i]
  }),
  nih: Object.freeze({
    origin: 'https://www.nih.no',
    catalogueUrl: 'https://www.nih.no/studier/programmer/',
    university: 'Norges idrettshøgskole',
    programmePath: /^\/studier\/programmer\/([^/]+)\/?(?:index\.html)?$/i,
    planPath: /^\/studier\/programmer\/([^/]+)\/(?:studieplaner|programplaner)\/([^/]+\.html)$/i,
    archivePath: /^\/studier\/program-og-emneplan-arkiv\/(?:[^/]+\/)*([^/]+\.html)$/i,
    coursePaths: [/^\/studier\/emner\/(?:[^/]+\/)*[^/]+\.html$/i]
  }),
  hiof: Object.freeze({
    origin: 'https://www.hiof.no',
    catalogueUrl: 'https://www.hiof.no/studier/programmer/',
    university: 'Høgskolen i Østfold',
    programmePath: /^\/studier\/programmer\/([^/]+)\/?(?:index\.html)?$/i,
    planPath: /^\/studier\/programmer\/([^/]+)\/studieplaner\/([^/]+\.html)$/i,
    coursePaths: [/^\/studier\/emner\/(?:[^/]+\/)*[^/]+\.html$/i]
  })
})

export function vortexProgramConfig(institution) {
  return vortexProgramInstitutions[institution] || null
}
