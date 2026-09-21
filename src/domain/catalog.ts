/**
 * Startbestueckung des Ziegel-Katalogs, uebernommen aus den vier
 * Tabellenblaettern der Excel (dort je Blatt die Zellen O3 bis O21).
 *
 * Diese Werte sind bewusst nur Startwerte - der Katalog ist in der App
 * vollstaendig pflegbar.
 */
import type { BrickType } from './types'

type Seed = Omit<BrickType, 'id' | 'updatedAt'>

export const CATALOG_SEED: Seed[] = [
  {
    name: 'Ziegel 36,5 cm',
    wallThicknessCm: 36.5,
    bricksPerSqm: 16,
    bricksPerPallet: 48,
    jambBricksPerPallet: 54,
    cornerBricksPerPallet: 21,
    lintelWidthCm: 12,
  },
  {
    // Blatt hiess "24 cm", enthielt aber 38 cm Wandstaerke. Wir nehmen den Wert,
    // nicht den Blattnamen.
    name: 'Ziegel 38 cm',
    wallThicknessCm: 38,
    bricksPerSqm: 10.7,
    bricksPerPallet: 30,
    jambBricksPerPallet: 54,
    cornerBricksPerPallet: 21,
    lintelWidthCm: 12,
  },
  {
    name: 'Ziegel 25 cm',
    wallThicknessCm: 25,
    bricksPerSqm: 10.7,
    bricksPerPallet: 30,
    jambBricksPerPallet: 54,
    cornerBricksPerPallet: 21,
    lintelWidthCm: 12,
  },
  {
    name: 'Ziegel 12 cm',
    wallThicknessCm: 12,
    bricksPerSqm: 10.7,
    bricksPerPallet: 30,
    jambBricksPerPallet: 54,
    cornerBricksPerPallet: 21,
    lintelWidthCm: 12,
  },
]
