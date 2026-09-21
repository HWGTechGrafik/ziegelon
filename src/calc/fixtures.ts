/**
 * Testdaten: ein Wandabschnitt, der die Rechenkette des Excel-Blatts
 * "36,5 cm" nachstellt. Die Erwartungswerte in den Tests sind von Hand aus
 * den Excel-Formeln gerechnet und im Test danebengeschrieben.
 */
import type { BrickType, Opening, Project, WallRun, WallSection } from '../domain/types'

const NOW = '2026-01-01T00:00:00.000Z'

export const brick365: BrickType = {
  id: 'bt-365',
  updatedAt: NOW,
  name: 'Ziegel 36,5 cm',
  wallThicknessCm: 36.5,
  bricksPerSqm: 16,
  bricksPerPallet: 48,
  jambBricksPerPallet: 54,
  cornerBricksPerPallet: 21,
  lintelWidthCm: 12,
}

const run = (id: string, lengthM: number, count = 1): WallRun => ({
  id,
  updatedAt: NOW,
  lengthM,
  count,
})

const opening = (
  id: string,
  kind: Opening['kind'],
  widthM: number,
  heightM: number,
  count: number,
): Opening => ({ id, updatedAt: NOW, kind, widthM, heightM, count })

export const section365: WallSection = {
  id: 'sec-1',
  updatedAt: NOW,
  label: 'Erdgeschoss Aussenwand',
  brickTypeId: brick365.id,
  storeyHeightM: 3,
  outerCorners: 4,
  bearingCmPerSide: 15,
  countDoorJambs: true,
  wallRuns: [run('r1', 10), run('r2', 8), run('r3', 10), run('r4', 8)],
  openings: [
    opening('o1', 'window', 1.5, 1.5, 3),
    opening('o2', 'window', 1.0, 1.25, 2),
    opening('o3', 'door', 1.0, 2.0, 1),
  ],
}

export const project365: Project = {
  id: 'p-1',
  updatedAt: NOW,
  createdAt: NOW,
  name: 'Testbauvorhaben',
  sections: [section365],
  orders: [],
  stock: [],
}
