'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Users, Banknote, Calendar, CheckCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import type { PaymentRecord } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'salary' | 'allowance'>('all');
  const [selectedMonthModal, setSelectedMonthModal] = useState<any | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (data.records) setRecords(data.records);
    } catch (e) {
      showToast('โหลดข้อมูลล้มเหลว', 'error');
    }
    setLoading(false);
  };

  const availableYears = useMemo(() => Array.from(new Set(records.map(r => r.year))).sort((a, b) => b - a), [records]);
  const availableMonths = useMemo(() => Array.from(new Set(records.map(r => r.month))).sort((a, b) => b - a), [records]);

  const filteredRecordsForStats = useMemo(() => {
    return records.filter(r => {
      const matchYear = filterYear === 'all' || r.year.toString() === filterYear;
      const matchMonth = filterMonth === 'all' || r.month.toString() === filterMonth;
      const matchType = filterType === 'all' || r.paymentType === filterType;
      return matchYear && matchMonth && matchType;
    });
  }, [records, filterYear, filterMonth, filterType]);

  const stats = useMemo(() => {
    const totalAmount = filteredRecordsForStats.reduce((sum, r) => sum + (r.payableAmount !== undefined ? r.payableAmount : r.amount), 0);
    const paidAmount = filteredRecordsForStats.filter(r => r.isPaid).reduce((sum, r) => sum + (r.payableAmount !== undefined ? r.payableAmount : r.amount), 0);
    const unpaidAmount = totalAmount - paidAmount;

    const uniquePeople = new Set(filteredRecordsForStats.map(r => r.firstName + r.lastName));
    const totalPeople = uniquePeople.size;

    const payableRecords = filteredRecordsForStats.filter(r => (r.payableAmount !== undefined ? r.payableAmount : r.amount) > 0);
    const totalPaidRecords = payableRecords.filter(r => r.isPaid).length;
    const totalUnpaidRecords = payableRecords.length - totalPaidRecords;

    const monthlyMap = new Map();
    filteredRecordsForStats.forEach(r => {
      const key = `${r.month}/${r.year}`;
      if (!monthlyMap.has(key)) monthlyMap.set(key, { name: key, total: 0, paid: 0, unpaid: 0, batches: {} });
      const entry = monthlyMap.get(key);
      const effectiveAmount = r.payableAmount !== undefined ? r.payableAmount : r.amount;
      entry.total += effectiveAmount;
      if (r.isPaid) entry.paid += effectiveAmount;
      else entry.unpaid += effectiveAmount;

      const parts = r.id.split('_');
      let batchName = 'อื่นๆ';
      if (parts.length >= 4 && parts[3] === 'allowance') {
        batchName = `เบี้ยเลี้ยง รอบ ${parts[2]}`;
      } else if (parts.length >= 3 && parts[2] === 'salary') {
        batchName = 'เงินเดือน';
      }
      if (!entry.batches[batchName]) entry.batches[batchName] = 0;
      entry.batches[batchName] += effectiveAmount;
    });
    const monthlyList = Array.from(monthlyMap.values()).sort((a: any, b: any) => {
      const [am, ay] = a.name.split('/').map(Number);
      const [bm, by] = b.name.split('/').map(Number);
      return (by * 100 + bm) - (ay * 100 + am);
    });

    return { totalAmount, paidAmount, unpaidAmount, totalPeople, totalPaidRecords, totalUnpaidRecords, monthlyList };
  }, [filteredRecordsForStats]);

  const exportExcel = () => {
    showToast('กำลังสร้างรายงาน Excel...', 'success');

    // Group records by Batch Name and Month/Year
    const sheetMap = new Map<string, any[]>();

    filteredRecordsForStats.forEach(r => {
      const parts = r.id.split('_');
      let batchName = 'อื่นๆ';
      if (parts.length >= 4 && parts[3] === 'allowance') {
        batchName = `เบี้ยเลี้ยงรอบ${parts[2]}`;
      } else if (parts.length >= 3 && parts[2] === 'salary') {
        batchName = 'เงินเดือน';
      }

      // e.g. "เงินเดือน 7-2026" or "เบี้ยเลี้ยงรอบ1 7-2026"
      const sheetKey = `${batchName} ${r.month}-${r.year}`;
      
      if (!sheetMap.has(sheetKey)) sheetMap.set(sheetKey, []);
      sheetMap.get(sheetKey)!.push(r);
    });

    const wb = XLSX.utils.book_new();

    sheetMap.forEach((recordsList, sheetKey) => {
      // Aggregate by person in case of duplicates in the same batch
      const peopleMap = new Map<string, any>();

      recordsList.forEach(r => {
        const personKey = `${r.firstName} ${r.lastName}`;
        if (!peopleMap.has(personKey)) {
          peopleMap.set(personKey, { 
            'ชื่อ': r.firstName, 
            'นามสกุล': r.lastName, 
            'ยอดเงิน': 0, 
            'สถานะการจ่าย': 'จ่ายครบ',
            'ผู้ออกบิล': r.issuedBy || '-'
          });
        }
        const personRow = peopleMap.get(personKey);
        
        const amount = r.payableAmount !== undefined ? r.payableAmount : r.amount;
        personRow['ยอดเงิน'] += amount;

        if (!r.isPaid) {
          personRow['สถานะการจ่าย'] = 'ค้างจ่าย';
        }
      });

      const dataToExport = Array.from(peopleMap.values()).map(p => ({
        'ชื่อ': p['ชื่อ'],
        'นามสกุล': p['นามสกุล'],
        'ยอดเงิน': p['ยอดเงิน'],
        'สถานะการจ่าย': p['สถานะการจ่าย'],
        'ผู้ออกบิล': p['ผู้ออกบิล'],
        'หมายเหตุ': ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      
      // Ensure sheet name is <= 31 chars
      const safeSheetName = sheetKey.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });

    if (sheetMap.size === 0) {
      const ws = XLSX.utils.json_to_sheet([{ 'ข้อความ': 'ไม่มีข้อมูล' }]);
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
    }

    XLSX.writeFile(wb, `Payment_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      {toast && (
        <div className="toast-overlay" onClick={() => setToast(null)}>
          <div className="toast-modal" onClick={e => e.stopPropagation()}>
            <div className="toast-icon">
              {toast.type === 'success' ? (
                <CheckCircle size={56} color="var(--success)" strokeWidth={2} />
              ) : (
                <X size={56} color="var(--danger)" strokeWidth={2} />
              )}
            </div>
            <div className="toast-message">
              {toast.msg}
            </div>
          </div>
        </div>
      )}

      <header className="flex-between" style={{ marginBottom: '24px', flexWrap: 'nowrap', gap: '8px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => router.push('/')}
          style={{ padding: '8px 12px', background: 'var(--surface)', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', flex: 1, textAlign: 'center' }}>
          ภาพรวมระบบ
        </div>
        <button
          className="btn btn-primary"
          onClick={exportExcel}
          style={{ padding: '8px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <Download size={18} style={{ marginRight: '4px' }} /> Export
        </button>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>กำลังโหลด...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลในระบบ</div>
      ) : (
        <div className="animate-fade-in">

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="custom-select custom-select-dark"
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: 'white' }}
            >
              <option value="all">ทุกปี</option>
              {availableYears.map(y => <option key={y} value={y.toString()}>ปี {y}</option>)}
            </select>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="custom-select custom-select-dark"
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: 'white' }}
            >
              <option value="all">ทุกเดือน</option>
              {availableMonths.map(m => <option key={m} value={m.toString()}>เดือน {m}</option>)}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="custom-select custom-select-dark"
              style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: 'white' }}
            >
              <option value="all">ทุกประเภท</option>
              <option value="salary">เฉพาะเงินเดือน</option>
              <option value="allowance">เฉพาะเบี้ยเลี้ยง</option>
            </select>
          </div>

          {/* Donut Chart (KBank Style) */}
          <div className="card" style={{ padding: '24px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '16px', alignSelf: 'flex-start', color: 'var(--text-primary)' }}>
              สัดส่วนการจ่ายเงิน
            </div>

            <div style={{ position: 'relative', width: '220px', height: '220px' }}>
              {!loading && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'จ่ายแล้ว', value: stats.paidAmount, color: '#10b981' },
                        { name: 'ค้างจ่าย', value: stats.unpaidAmount, color: '#ef4444' },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={8}
                    >
                      {[
                        { name: 'จ่ายแล้ว', value: stats.paidAmount, color: '#10b981' },
                        { name: 'ค้างจ่าย', value: stats.unpaidAmount, color: '#ef4444' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any) => `฿${Number(value).toLocaleString()}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {/* Center Text */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ยอดรวม</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                  ฿{(stats.totalAmount > 10000 ? (stats.totalAmount / 1000).toFixed(1) + 'k' : stats.totalAmount.toLocaleString())}
                </div>
              </div>
            </div>

            {/* Legend below the chart */}
            <div style={{ display: 'flex', gap: '24px', marginTop: '16px', width: '100%', justifyContent: 'center', padding: '16px 0 0 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} /> จ่ายแล้ว
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>฿{stats.paidAmount.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.totalPaidRecords} รายการ</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} /> ค้างจ่าย
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>฿{stats.unpaidAmount.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.totalUnpaidRecords} รายการ</div>
              </div>
            </div>
          </div>

          {/* Top Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div className="card flex-between" style={{ marginBottom: 0, padding: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <Banknote size={16} /> ยอดเงินทั้งหมด
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>฿{stats.totalAmount.toLocaleString()}</div>
              </div>
            </div>
            <div className="card flex-between" style={{ marginBottom: 0, padding: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <Users size={16} /> จำนวนกำลังพล
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{stats.totalPeople} นาย</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', paddingLeft: '8px' }}>
            สรุปรายเดือน
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.monthlyList.map(m => (
              <div
                key={m.name}
                className="card"
                style={{ padding: '16px', marginBottom: 0, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s' }}
                onClick={() => setSelectedMonthModal(m)}
              >
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} color="var(--primary)" /> {m.name}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>฿{m.total.toLocaleString()}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>จ่ายแล้ว</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>฿{m.paid.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>ค้างจ่าย</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}>฿{m.unpaid.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedMonthModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setSelectedMonthModal(null)}>
              <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: 0 }} onClick={e => e.stopPropagation()}>
                <div className="flex-between" style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} /> เดือน {selectedMonthModal.name}
                  </div>
                  <button onClick={() => setSelectedMonthModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>รายละเอียดแต่ละรอบบิล</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(selectedMonthModal.batches)
                      .sort((a, b) => {
                        if (a[0] === 'เงินเดือน') return -1;
                        if (b[0] === 'เงินเดือน') return 1;
                        return a[0].localeCompare(b[0]);
                      })
                      .map(([batchName, amount]: [string, any]) => (
                        <div key={batchName} className="flex-between" style={{ padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{batchName}</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>฿{amount.toLocaleString()}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
