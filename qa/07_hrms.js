// QA artifact - HRMS scenarios T20-T21 (R22/R23).
// Usage: node qa/07_hrms.js
const { request, readEvidence, writeEvidence, recordResult } = require('./lib');
const f = readEvidence('fixtures.json');
const t = f.tenants.usa825;
const output = {};

async function main() {
  const stamp = Date.now();
  const newEmail = `hrms.new.${stamp}@qa.local`;
  const empNew = await request('POST', '/hrms/employees', {
    token: t.ownerToken,
    body: { mode: 'new_user', name: 'QA HRMS New', email: newEmail, password: 'QaPass123',
      phone: '92300000123', designation: 'Pharmacist', department: 'Pharmacy',
      joiningDate: '2026-01-01', salary: 1000, role: 'STAFF' }
  });
  const newLogin = await request('POST', '/auth/login', { body: { email: newEmail, password: 'QaPass123' } });
  // Link the existing STAFF user (id recovered from staff login response).
  const staffProfile = await request('GET', '/users/profile', { token: t.staffToken });
  const staffId = staffProfile.data?.data?.id;
  const empLinkReal = await request('POST', '/hrms/employees', {
    token: t.ownerToken,
    body: { mode: 'link_existing', userId: staffId, designation: 'QA Linked Staff',
      joiningDate: '2026-01-01', salary: 500 }
  });
  const deactivateId = empNew.data?.data?.employeeId || empNew.data?.data?.id;
  const deactivate = deactivateId
    ? await request('PUT', `/hrms/employees/${deactivateId}`, { token: t.ownerToken, body: { employmentStatus: 'Inactive' } })
    : null;
  const loginAfterDeactivate = await request('POST', '/auth/login', { body: { email: newEmail, password: 'QaPass123' } });
  output.T20 = {
    newEmployee: { status: empNew.status, data: empNew.data },
    newLoginStatus: newLogin.status,
    linkExisting: { status: empLinkReal.status, data: empLinkReal.data },
    deactivate: { status: deactivate?.status, id: deactivateId },
    loginAfterDeactivate: { status: loginAfterDeactivate.status, message: loginAfterDeactivate.data?.message }
  };
  recordResult('T20', empNew.status === 201 && newLogin.status === 200 && empLinkReal.status === 201 &&
    deactivate?.status === 200 ? 'PASS' : 'FAIL', output.T20);
  recordResult('R22', empNew.status === 201 && empLinkReal.status === 201 ? 'PASS' : 'FAIL', output.T20);

  // ---- T21: payroll arithmetic, batch generation, pay, payslip data ----
  const empId = deactivateId;
  const salary = await request('POST', '/hrms/salaries', {
    token: t.ownerToken,
    body: { employeeId: empId, month: 6, year: 2026, basicSalary: 1000, allowances: 200, deductions: 50 }
  });
  const salaryId = salary.data?.data?.salaryId || salary.data?.data?.id;
  const batch = await request('POST', '/hrms/salaries/batch-generate', {
    token: t.ownerToken, body: { month: 7, year: 2026 }
  });
  const pay = salaryId ? await request('PUT', `/hrms/salaries/${salaryId}/pay`, {
    token: t.ownerToken, body: { paymentMethod: 'Bank Transfer', paymentDate: '2026-06-30' }
  }) : null;
  const payAgain = salaryId ? await request('PUT', `/hrms/salaries/${salaryId}/pay`, {
    token: t.ownerToken, body: { paymentMethod: 'Cash' }
  }) : null;
  const list = await request('GET', '/hrms/salaries?month=6&year=2026', { token: t.ownerToken });
  const row = (list.data?.data?.salaries || []).find(s => s.SalaryId === salaryId || s.id === salaryId);
  output.T21 = {
    salaryCreate: { status: salary.status, data: salary.data },
    batch: { status: batch.status, data: batch.data },
    pay: { status: pay?.status, message: pay?.data?.message },
    payAgain: { status: payAgain?.status, message: payAgain?.data?.message },
    salaryRow: row || null
  };
  recordResult('T21', salary.status === 201 && batch.status === 200 && pay?.status === 200 &&
    payAgain?.status === 400 ? 'PASS' : 'FAIL', output.T21);
  recordResult('R23', (output.T21.salaryRow?.NetSalary === 1150 || output.T21.salaryRow?.netSalary === 1150) &&
    payAgain?.status === 400 ? 'PASS' : 'FAIL', output.T21);
  recordResult('N7', payAgain?.status === 400 ? 'REFUTED' : 'CONFIRMED',
    `Second pay returned ${payAgain?.status}`);

  // ---- R24: attendance CRUD is owner-only and persisted ----
  const attendanceDate = '2026-11-24';
  const staffAttendance = await request('GET', '/hrms/attendance', { token: t.staffToken });
  const createAttendance = await request('POST', '/hrms/attendance', {
    token: t.ownerToken,
    body: { employeeId: deactivateId, date: attendanceDate, status: 'Present', checkIn: '09:00', checkOut: '17:00' }
  });
  const attendanceId = createAttendance.data?.data?.id;
  const listAttendance = await request('GET', `/hrms/attendance?date=${attendanceDate}`, { token: t.ownerToken });
  const updateAttendance = attendanceId ? await request('PUT', `/hrms/attendance/${attendanceId}`, {
    token: t.ownerToken, body: { status: 'Leave', notes: 'QA update' }
  }) : null;
  const deleteAttendance = attendanceId ? await request('DELETE', `/hrms/attendance/${attendanceId}`, { token: t.ownerToken }) : null;
  output.R24 = {
    staffListStatus: staffAttendance.status,
    createStatus: createAttendance.status,
    listStatus: listAttendance.status,
    listCount: (listAttendance.data?.data?.attendance || []).length,
    updateStatus: updateAttendance?.status,
    deleteStatus: deleteAttendance?.status
  };
  recordResult('R24', staffAttendance.status === 403 && createAttendance.status === 201 &&
    listAttendance.status === 200 && output.R24.listCount > 0 &&
    updateAttendance?.status === 200 && deleteAttendance?.status === 200 ? 'PASS' : 'FAIL', output.R24);

  writeEvidence('hrms.json', output);
  console.log('HRMS_DONE');
}

main().catch((error) => { console.error(error); process.exit(1); });
