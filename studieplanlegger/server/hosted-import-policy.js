import { publicTpViewSelection, isPublicTpCalendarUrl } from './providers/public-tp.js'
import { publicTimeEditInstitutions, publicTimeEditUrl } from './providers/public-timeedit.js'
import { isPublicPlandiscUrl } from './providers/plandisc-calendar.js'
import { ansgarPublicShareUrl } from './providers/ansgar-public-share.js'
import { fihCalendarUrl } from './providers/fih-calendar.js'
import { hfyPdfUrl } from './providers/hfy-programs.js'
import { gestaltPdfUrl } from './providers/gestalt-programs.js'
import { phsExamUrl } from './providers/phs-calendar.js'
import { restrictedUrl } from './providers/program-source.js'

// Existing integrations only. A listed host is never sufficient on its own:
// every fetch also needs the provider's path/query guard or a direct-source
// guard below. Keep this boundary independent of user input and DNS answers.
const providerHosts = new Set([
  'aho.no', 'www.aho.no', 'ansgarhoyskole.no', 'www.ansgarhoyskole.no',
  'ansgarskolenno-my.sharepoint.com', 'barnebokinstituttet.no', 'barrattdue.no',
  'bas.org', 'cloud.timeedit.net', 'create.plandisc.com', 'drive.google.com',
  'drive.usercontent.google.com', 'fih.edupage.org', 'fih.fjellhaug.no',
  'gestalt.no', 'www.gestalt.no', 'hfy.no', 'www.hfy.no', 'hgut.no', 'hlt.no',
  'img1.wsimg.com', 'khio.no', 'ldh.no', 'limpimusic.com', 'mf.no', 'www.mf.no',
  'nhfh.no', 'www.nhfh.no', 'nmh-nettsted.s3.amazonaws.com', 'nski.no', 'www.nski.no',
  'oslonyehoyskole.no', 'www.oslonyehoyskole.no', 's293.usn.no',
  's3.eu-west-1.amazonaws.com', 's3-gustav.imgix.net', 'samas.no',
  'skrivekunst.no', 'www.skrivekunst.no', 'student.nmh.no', 'student.oslomet.no',
  'studiekatalog.edutorium.no', 'studier.dmmh.no', 'tp.educloud.no', 'uit.no',
  'www.bi.no', 'www.forsvaret.no', 'www.hfdk.no', 'www.himolde.no', 'www.hiof.no',
  'www.hivolda.no', 'www.hvl.no', 'www.kristiania.no', 'www.krus.no', 'www.nhh.no',
  'www.nih.no', 'www.nla.no', 'www.nmbu.no', 'www.nord.no', 'www.ntnu.no',
  'www.politihogskolen.no', 'www.steinerhoyskolen.no', 'www.uia.no', 'www.uio.no',
  'www.uis.no', 'www.usn.no', 'www.vid.no', 'www4.uib.no',
])

const rejectSource = () => { throw new Error('Nettversjonen henter bare gjenkjente offentlige studiekilder. Last ned kalenderen som en .ics-fil og bruk filimport for andre lenker.') }

export function hostedSourceUrl(input) {
  let url
  try { url = new URL(String(input).replace(/^webcal:/i, 'https:')) } catch { rejectSource() }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
    url.port && url.port !== '443' || !providerHosts.has(url.hostname) || url.href.length > 8192) rejectSource()
  return url
}

function directCalendarUrl(input) {
  const url = hostedSourceUrl(input)
  if (url.hostname === 'cloud.timeedit.net' && /\/ri[A-Za-z0-9]*\.ics$/.test(url.pathname)) {
    for (const institution of publicTimeEditInstitutions.filter(id => id !== 'khio')) {
      try { return publicTimeEditUrl(url, institution) } catch { /* Try the next existing integration. */ }
    }
    return restrictedUrl(url, { origin: 'https://cloud.timeedit.net', paths: [/^\/khio\/web\/(?:ballett|opera|teater|design|kunsthandv|ka)\/ri[A-Za-z0-9]*\.ics$/], keys: ['h', 'sid', 'objects', 'ox', 'p', 'e', 'enol', 'start', 'end'] })
  }
  // NTNU's course pages publish this legacy calendar form, including id[0].
  if (url.hostname === 'tp.educloud.no' && url.pathname === '/ntnu/timeplan/ical.php') {
    const entries = [...url.searchParams], ids = entries.filter(([key]) => /^id\[(?:\d{1,2})?\]$/.test(key))
    if (url.searchParams.get('type') !== 'course' || !/^\d{2}[hv]$/.test(url.searchParams.get('sem') || '') ||
      !ids.length || ids.length > 40 || ids.some(([, value]) => !/^[\p{L}\p{N}_.\/-]{1,120}(?:,\d{1,2})?$/u.test(value)) ||
      entries.some(([key, value]) => !['type', 'sem', 'rkey'].includes(key) && !/^id\[(?:\d{1,2})?\]$/.test(key) || key === 'rkey' && !/^\d{1,20}$/.test(value)) ||
      ['type', 'sem', 'rkey'].some(key => url.searchParams.getAll(key).length > 1)) rejectSource()
    return url
  }
  rejectSource()
}

export function hostedCalendarSource(input) {
  const url = hostedSourceUrl(input)
  if (publicTpViewSelection(url.href) || isPublicTpCalendarUrl(url.href) || isPublicPlandiscUrl(url.href)) return url
  const guards = {
    'ansgarskolenno-my.sharepoint.com': ansgarPublicShareUrl,
    'fih.edupage.org': fihCalendarUrl,
    's3-gustav.imgix.net': hfyPdfUrl,
    'img1.wsimg.com': gestaltPdfUrl,
    'www.politihogskolen.no': phsExamUrl,
  }
  return guards[url.hostname] ? guards[url.hostname](url) : directCalendarUrl(url)
}

export function hostedSourceGuard(input, providerGuard) {
  const initial = hostedSourceUrl(input)
  if (!providerGuard) {
    // The legacy NMBU details adapter constructs its URL from a validated code.
    if (!(initial.origin === 'https://www.nmbu.no' && /^\/emne\/[a-z\d-]{2,30}$/.test(initial.pathname) && !initial.search)) directCalendarUrl(initial)
  }
  return input => {
    const url = hostedSourceUrl(input)
    // Give the adapter a copy so canonicalization cannot mutate the URL which
    // passed the outer HTTPS/origin boundary.
    if (providerGuard) providerGuard(new URL(url.href))
    else if (url.href !== initial.href) rejectSource()
    return url
  }
}

export function authorizeHostedImport(req) {
  // Vercel routes Host to this project. Compare Origin with that routed host,
  // supporting preview/production aliases without trusting forwarded headers.
  // This is browser same-origin protection, not authentication or rate limiting.
  const host = req.headers.host
  if (typeof host !== 'string' || !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z\d-]{2,63}$/i.test(host) ||
    req.headers.origin !== undefined && req.headers.origin !== `https://${host}` ||
    !['', 'same-origin', 'none'].includes(String(req.headers['sec-fetch-site'] || '').toLowerCase())) {
    throw new Error('Henting må startes fra Ajour på dette nettstedet.')
  }
}

export const hostedImportPolicy = Object.freeze({
  authorize: authorizeHostedImport,
  calendarSource: hostedCalendarSource,
  sourceGuard: hostedSourceGuard,
  deadlineMs: 50_000,
})
