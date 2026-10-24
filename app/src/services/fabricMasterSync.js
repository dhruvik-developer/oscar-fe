/**
 * Textile masters — fabric quality, design, colour/shade, fabric type and UOM.
 *
 * Rows live in Postgres under `/inventory/…`. With no session the pages keep
 * a localStorage copy instead, so the screens still work offline.
 */
import { compact, createSync } from './resourceSync';

export { isBackendEnabled, describeError, isServerId } from './resourceSync';

const num = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

const master = (path, extra = () => ({})) => ({
  path,
  toApi: (row) => compact({
    name: row.name,
    code: row.code ?? undefined,
    description: row.description ?? undefined,
    isActive: row.isActive,
    ...extra(row),
  }),
});

export const fabricMasterSync = createSync({
  fabricQualities: master('/inventory/fabric-qualities/', (row) => ({
    fabricId: row.fabricId || null,
    fabricTypeId: row.fabricTypeId || null,
    composition: row.composition || null,
    uomId: row.uomId || null,
    uom: row.uom || null,
    width: num(row.width),
    gsm: num(row.gsm),
    reed: num(row.reed),
    pick: num(row.pick),
    warpCount: row.warpCount || null,
    weftCount: row.weftCount || null,
    imageUrl: row.imageUrl || null,
    imageFileId: row.imageFileId || null,
  })),
  // Only fields present on `row` are sent, so a status-only PATCH leaves the
  // pattern, season and image as they are.
  designs: master('/inventory/designs/', (row) => ({
    patternType: 'patternType' in row ? row.patternType || null : undefined,
    season: 'season' in row ? row.season || null : undefined,
    reference: 'reference' in row ? row.reference || null : undefined,
    imageFileId: 'imageFileId' in row ? row.imageFileId || null : undefined,
  })),
  shades: master('/inventory/shades/', (row) => ({
    colourType: 'colourType' in row ? row.colourType || 'Solid' : undefined,
    pantoneReference: 'pantoneReference' in row ? row.pantoneReference || null : undefined,
    imageUrl: 'imageUrl' in row ? row.imageUrl || null : undefined,
    imageFileId: 'imageFileId' in row ? row.imageFileId || null : undefined,
    hexColor: 'hexColor' in row ? row.hexColor || null : undefined,
  })),
  fabricVariants: master('/inventory/fabric-variants/', (row) => {
    const pick = (key, value) => (key in row ? value : undefined);
    return {
      qualityId: pick('qualityId', row.qualityId || null),
      designId: pick('designId', row.designId || null),
      shadeId: pick('shadeId', row.shadeId || null),
      categoryId: pick('categoryId', row.categoryId || null),
      fabricTypeId: pick('fabricTypeId', row.fabricTypeId || null),
      itemId: pick('itemId', row.itemId || null),
      uomId: pick('uomId', row.uomId || null),
      uom: pick('uom', row.uom || null),
      hsnCode: pick('hsnCode', row.hsnCode || null),
      fabricType: pick('fabricType', row.fabricType || null),
      construction: pick('construction', row.construction || null),
      imageUrl: pick('imageUrl', row.imageUrl || null),
      rate: pick('rate', num(row.rate)),
      imageFileId: pick('imageFileId', row.imageFileId || null),
    };
  }),
  fabricTypes: master('/inventory/fabric-types/', (row) => ({
    processStage: 'processStage' in row ? row.processStage || 'Grey' : undefined,
    imageUrl: 'imageUrl' in row ? row.imageUrl || null : undefined,
    imageFileId: 'imageFileId' in row ? row.imageFileId || null : undefined,
  })),
  fabrics: master('/inventory/fabrics/'),
  categories: master('/inventory/categories/', (row) => ({
    parentId: 'parentId' in row ? row.parentId || null : undefined,
    parent: 'parent' in row ? row.parent || null : undefined,
    imageUrl: 'imageUrl' in row ? row.imageUrl || null : undefined,
    imageFileId: 'imageFileId' in row ? row.imageFileId || null : undefined,
    kind: 'kind' in row ? row.kind || 'stock' : undefined,
  })),
  units: {
    path: '/inventory/units/',
    // Only fields present on `row` are sent, so a status-only PATCH leaves the
    // rest of the unit alone.
    toApi: (row) => {
      const pick = (key, value) => (key in row ? value : undefined);
      return compact({
        code: row.code,
        label: row.label || row.name || row.code,
        uomType: pick('uomType', row.uomType || 'Other'),
        isBaseUnit: pick('isBaseUnit', Boolean(row.isBaseUnit)),
        decimalPlaces: pick('decimalPlaces', num(row.decimalPlaces) ?? 2),
        conversionFactor: pick('conversionFactor', num(row.conversionFactor) ?? 1),
        description: pick('description', row.description || null),
        isActive: row.isActive,
        imageUrl: pick('imageUrl', row.imageUrl || null),
        imageFileId: pick('imageFileId', row.imageFileId || null),
      });
    },
  },
}, { label: 'fabricMasters' });
