import { createFihEdgeHandler } from '../server/fih-edge-transport.js'

export const config = { runtime: 'edge' }
export default createFihEdgeHandler(process.env.VERCEL_URL)
