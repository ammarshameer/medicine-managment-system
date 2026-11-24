/**
 * Shared controlled-substance rules.
 *
 * The definition deliberately depends on the business country:
 *  - USA: only DEA Schedule II is treated as controlled (Schedules III-V are not).
 *  - UAE: only UAE "Controlled" and "Narcotic" classifications are controlled
 *    ("POM", "Pharmacist-Only" and "Semi-Controlled" are not).
 * Any other (or unknown) country is treated as having no controlled items.
 */

const CONTROLLED_ACTIONS = ['Dispensed', 'Received', 'Adjusted', 'Destroyed', 'Reversed'];

function normalizeCountry(country) {
  const value = String(country || '').trim().toUpperCase();
  if (['USA', 'US', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(value)) return 'USA';
  if (['UAE', 'AE', 'UNITED ARAB EMIRATES'].includes(value)) return 'UAE';
  return value;
}

function isControlledMedicine(medicine = {}, country) {
  const rule = normalizeCountry(country);
  if (rule === 'USA') {
    const schedule = String(medicine.DEASchedule || medicine.deaSchedule || 'None').trim().toUpperCase();
    return schedule === 'II' || schedule === 'SCHEDULE II';
  }
  if (rule === 'UAE') {
    const classification = String(medicine.UAEClassification || medicine.uaeClassification || 'OTC')
      .trim()
      .toLowerCase();
    return classification === 'controlled' || classification === 'narcotic';
  }
  return false;
}

/** Build the INSERT for a controlled-substance ledger entry (works with a pool or a transaction). */
function buildControlledLogInsert({
  businessId,
  medicineId,
  orderId = null,
  prescriptionId = null,
  action,
  quantity,
  performedBy,
  notes = null
}) {
  if (!CONTROLLED_ACTIONS.includes(action)) {
    throw new Error(`Invalid controlled substance action: ${action}`);
  }
  return {
    sql: `INSERT INTO ControlledSubstanceLog
          (BusinessId, MedicineId, OrderId, PrescriptionId, Action, Quantity, PerformedBy, Notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      businessId,
      medicineId,
      orderId || null,
      prescriptionId || null,
      action,
      quantity,
      performedBy,
      notes
    ]
  };
}

async function insertControlledLog(query, entry) {
  const { sql, params } = buildControlledLogInsert(entry);
  return query(sql, params);
}

/**
 * Validate a prescription for a controlled-substance sale.
 * `query` must be a function returning an array of rows.
 * Returns { ok: false, status, message } or { ok: true, prescriptionId }.
 */
async function validateControlledPrescription(query, { prescriptionId, businessId, customerUserId, medicineName }) {
  if (!prescriptionId) {
    return {
      ok: false,
      status: 400,
      message: `Controlled medicine "${medicineName || 'selected item'}" requires an approved prescriptionId`
    };
  }

  const id = Number.parseInt(prescriptionId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, status: 400, message: 'A valid prescriptionId is required for controlled medicines' };
  }

  if (!customerUserId) {
    return {
      ok: false,
      status: 400,
      message: 'A customer (userId) or an approved prescription identifying the customer is required for controlled medicines'
    };
  }

  const prescriptions = await query(
    'SELECT PrescriptionId, UserId, Status FROM Prescriptions WHERE PrescriptionId = ? AND BusinessId = ?',
    [id, businessId]
  );

  if (prescriptions.length === 0) {
    return { ok: false, status: 400, message: 'Prescription not found in this business' };
  }

  const prescription = prescriptions[0];
  if (Number(prescription.UserId) !== Number(customerUserId)) {
    return { ok: false, status: 400, message: 'Prescription does not belong to the ordering customer' };
  }
  if (prescription.Status !== 'Approved') {
    return { ok: false, status: 400, message: 'Prescription must be approved before dispensing controlled medicines' };
  }

  return { ok: true, prescriptionId: id };
}

/**
 * Reverse Dispensed ledger rows for an order that is cancelled/voided.
 * The original Dispensed row is kept for audit integrity and an explicit
 * 'Reversed' row is written for every dispensed line.
 */
async function reverseDispensedLogs(query, { businessId, orderId, performedBy, reason }) {
  const dispensed = await query(
    `SELECT LogId, MedicineId, Quantity, PrescriptionId
     FROM ControlledSubstanceLog
     WHERE BusinessId = ? AND OrderId = ? AND Action = 'Dispensed'`,
    [businessId, orderId]
  );

  for (const row of dispensed) {
    await insertControlledLog(query, {
      businessId,
      medicineId: row.MedicineId,
      orderId,
      prescriptionId: row.PrescriptionId,
      action: 'Reversed',
      quantity: Math.abs(Number(row.Quantity) || 0),
      performedBy,
      notes: `Reversed Dispensed entry - ${reason}`
    });
  }

  return dispensed.length;
}

module.exports = {
  CONTROLLED_ACTIONS,
  normalizeCountry,
  isControlledMedicine,
  buildControlledLogInsert,
  insertControlledLog,
  validateControlledPrescription,
  reverseDispensedLogs
};
