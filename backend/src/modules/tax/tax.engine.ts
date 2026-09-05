/**
 * Centralized Deterministic Tax Engine
 * Sole authoritative source for all GST calculations, POS determination, and RCM classifications.
 */

export interface TaxContext {
  supplierLocation: {
    stateCode: string;
    gstin?: string;
    isSez?: boolean;
  };
  recipientLocation: {
    stateCode: string;
    gstin?: string;
    registrationType?: 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED' | 'OVERSEAS';
  };
  placeOfSupply: string; // 2-digit Indian State Code (e.g. "27" for Maharashtra)
  supplyType?: 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' | 'EXPORT_WITH_TAX' | 'EXPORT_WITHOUT_TAX' | 'SEZ';
  isReverseCharge?: boolean;
  taxablePaise: number;  // In Paise
  gstRate: number;       // e.g. 18
  cessRate?: number;     // e.g. 0
}

export interface TaxCalculationResult {
  isIntraState: boolean;
  isExport: boolean;
  isSez: boolean;
  isReverseCharge: boolean;
  cgstRate: number;
  cgstPaise: number;
  sgstRate: number;
  sgstPaise: number;
  igstRate: number;
  igstPaise: number;
  cessRate: number;
  cessPaise: number;
  totalTaxPaise: number;
}

/**
 * Evaluates Indian GST laws (CGST / SGST / IGST Acts) deterministically.
 */
export function resolveTaxTreatment(ctx: TaxContext): TaxCalculationResult {
  const taxable = Math.max(0, Math.round(ctx.taxablePaise));
  const rate = Math.max(0, ctx.gstRate || 0);
  const cessRate = Math.max(0, ctx.cessRate || 0);
  const isRcm = Boolean(ctx.isReverseCharge);
  const isSez = Boolean(ctx.supplierLocation.isSez);

  // Check Export condition
  const isExport =
    ctx.supplyType === 'EXPORT_WITH_TAX' ||
    ctx.supplyType === 'EXPORT_WITHOUT_TAX' ||
    ctx.recipientLocation.registrationType === 'OVERSEAS';

  if (isExport && ctx.supplyType === 'EXPORT_WITHOUT_TAX') {
    return {
      isIntraState: false,
      isExport: true,
      isSez,
      isReverseCharge: isRcm,
      cgstRate: 0,
      cgstPaise: 0,
      sgstRate: 0,
      sgstPaise: 0,
      igstRate: 0,
      igstPaise: 0,
      cessRate: 0,
      cessPaise: 0,
      totalTaxPaise: 0,
    };
  }

  // Place of Supply vs Supplier State determines Intra-state vs Inter-state
  // If either supplier or recipient is in SEZ, transaction is treated as Inter-State (IGST)
  const isIntraState =
    ctx.supplierLocation.stateCode === ctx.placeOfSupply && !isSez && !isExport;

  const rawGstPaise = Math.round((taxable * rate) / 100);
  const rawCessPaise = Math.round((taxable * cessRate) / 100);

  if (isIntraState) {
    const halfRate = rate / 2;
    const halfTaxPaise = Math.round(rawGstPaise / 2);
    const actualGstTotal = halfTaxPaise * 2;

    return {
      isIntraState: true,
      isExport: false,
      isSez,
      isReverseCharge: isRcm,
      cgstRate: halfRate,
      cgstPaise: halfTaxPaise,
      sgstRate: halfRate,
      sgstPaise: halfTaxPaise,
      igstRate: 0,
      igstPaise: 0,
      cessRate,
      cessPaise: rawCessPaise,
      totalTaxPaise: actualGstTotal + rawCessPaise,
    };
  } else {
    return {
      isIntraState: false,
      isExport,
      isSez,
      isReverseCharge: isRcm,
      cgstRate: 0,
      cgstPaise: 0,
      sgstRate: 0,
      sgstPaise: 0,
      igstRate: rate,
      igstPaise: rawGstPaise,
      cessRate,
      cessPaise: rawCessPaise,
      totalTaxPaise: rawGstPaise + rawCessPaise,
    };
  }
}

export class TaxEngine {
  static resolveTaxTreatment(ctx: {
    companyStateCode: string;
    partyStateCode?: string;
    placeOfSupply: string;
    isSEZ?: boolean;
    isExport?: boolean;
    isReverseCharge?: boolean;
  }) {
    const isIntraState =
      ctx.companyStateCode === ctx.placeOfSupply && !ctx.isSEZ && !ctx.isExport;
    return {
      isIntraState,
      isExport: Boolean(ctx.isExport),
      isSEZ: Boolean(ctx.isSEZ),
      isReverseCharge: Boolean(ctx.isReverseCharge),
    };
  }

  static calculateLineTaxPaise(
    netGrossPaise: number,
    taxRate: number,
    isTaxInclusive: boolean,
    treatment: { isIntraState: boolean; isExport?: boolean; isSEZ?: boolean }
  ) {
    let taxableAmountPaise = netGrossPaise;
    let totalTaxPaise = 0;

    if (isTaxInclusive && taxRate > 0) {
      taxableAmountPaise = Math.round((netGrossPaise * 10000) / (10000 + taxRate * 100));
      totalTaxPaise = netGrossPaise - taxableAmountPaise;
    } else if (!isTaxInclusive && taxRate > 0) {
      taxableAmountPaise = netGrossPaise;
      totalTaxPaise = Math.round((netGrossPaise * taxRate) / 100);
    }

    if (treatment.isExport && !treatment.isSEZ) {
      return {
        taxableAmountPaise,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
        totalPaise: taxableAmountPaise,
      };
    }

    if (treatment.isIntraState) {
      const halfTax = Math.round(totalTaxPaise / 2);
      const actualTotalTax = halfTax * 2;
      return {
        taxableAmountPaise,
        cgstPaise: halfTax,
        sgstPaise: halfTax,
        igstPaise: 0,
        totalTaxPaise: actualTotalTax,
        totalPaise: taxableAmountPaise + actualTotalTax,
      };
    } else {
      return {
        taxableAmountPaise,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: totalTaxPaise,
        totalTaxPaise,
        totalPaise: taxableAmountPaise + totalTaxPaise,
      };
    }
  }
}
