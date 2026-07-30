'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Download, Upload, FileSpreadsheet, CheckCircle, Circle, Search, ChevronLeft, ChevronRight, BarChart2, LogOut, Calculator, Trash2, X, Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { PaymentRecord } from '@/types';

export default function Home() {
  const router = useRouter();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'latest' | 'history' | 'batches'>('latest');
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [confirmBatchPrefix, setConfirmBatchPrefix] = useState<string | null>(null);
  const [confirmRecordToDelete, setConfirmRecordToDelete] = useState<string | null>(null);

  const [uploadType, setUploadType] = useState<'salary' | 'allowance'>('salary');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'salary' | 'allowance' | 'mule'>('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [batchCurrentPage, setBatchCurrentPage] = useState(1);
  const batchItemsPerPage = 10;

  const [cancelerName, setCancelerName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRecords();
    const savedCanceler = localStorage.getItem('issuerName');
    if (savedCanceler) setCancelerName(savedCanceler);
  }, []);

  // Reset pagination when tab, search, category, or batch changes
  useEffect(() => {
    setCurrentPage(1);
    setBatchCurrentPage(1);
  }, [activeTab, searchQuery, categoryFilter, batchFilter]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      router.push('/login');
    } catch (err) { }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (data.records) {
        setRecords(data.records);
      }
    } catch (e) {
      showToast('โหลดข้อมูลล้มเหลว', 'error');
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newRecords: PaymentRecord[] = [];
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        data.forEach(row => {
          const keys = Object.keys(row);
          const nameCol = keys.find(k => k.includes('ชื่อ'));
          const surnameCol = keys.find(k => k.includes('สกุล'));
          const amountCol = keys.find(k => k.includes('เงิน') || k.includes('ยอด'));

          if (nameCol && amountCol) {
            const firstName = String(row[nameCol] || '').trim();
            const lastName = surnameCol ? String(row[surnameCol] || '').trim() : '';
            const amount = Number(row[amountCol]) || 0;

            if (firstName && amount > 0) {
              const recId = `${currentYear}_${currentMonth}_${uploadType}_${firstName}_${lastName}`.replace(/\s+/g, '');
              newRecords.push({
                id: recId,
                month: currentMonth,
                year: currentYear,
                firstName,
                lastName,
                amount,
                paymentType: uploadType,
                isPaid: false
              });
            }
          }
        });

        if (newRecords.length === 0) {
          showToast('ไม่พบข้อมูลที่ถูกต้องในไฟล์', 'error');
          return;
        }

        setLoading(true);
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: newRecords })
        });

        if (res.ok) {
          showToast(`นำเข้าข้อมูล${uploadType === 'salary' ? 'เงินเดือน' : 'เบี้ยเลี้ยง'}สำเร็จ!`, 'success');
          fetchRecords();
        } else {
          showToast('บันทึกข้อมูลล้มเหลว', 'error');
        }
      } catch (err) {
        showToast('ไฟล์ไม่ถูกต้อง', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const togglePayment = async (e: React.MouseEvent, record: PaymentRecord) => {
    e.stopPropagation(); // Prevent card click
    const newIsPaid = !record.isPaid;
    const newPaidAt = newIsPaid ? new Date().toISOString() : undefined;

    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, isPaid: newIsPaid, paidAt: newPaidAt } : r));

    try {
      const res = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id, isPaid: newIsPaid, paidAt: newPaidAt })
      });
      if (!res.ok) throw new Error('Failed');
    } catch (err) {
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, isPaid: record.isPaid, paidAt: record.paidAt } : r));
      showToast('อัปเดตสถานะไม่สำเร็จ', 'error');
    }
  };
  const confirmDeleteRecord = (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    setConfirmRecordToDelete(recordId);
  };

  const executeDeleteRecord = async () => {
    if (!confirmRecordToDelete) return;
    if (!cancelerName.trim()) {
      showToast('กรุณาระบุชื่อผู้ยกเลิกบิลก่อนลบ', 'error');
      return;
    }
    const recordId = confirmRecordToDelete;
    setConfirmRecordToDelete(null);

    // Optimistic UI update
    setRecords(prev => prev.filter(r => r.id !== recordId));

    try {
      const res = await fetch(`/api/payments?recordId=${encodeURIComponent(recordId)}&canceledBy=${encodeURIComponent(cancelerName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed');
      showToast('ลบบิลสำเร็จ', 'success');
    } catch (err) {
      // Re-fetch on failure to restore
      fetchRecords();
      showToast('ลบบิลไม่สำเร็จ', 'error');
    }
  };
  const downloadTemplate = async () => {
    try {
      showToast('กำลังเตรียมไฟล์เทมเพลต...', 'success');
      const res = await fetch('/api/personnel');
      const data = await res.json();

      let templateData: any[] = [{ ชื่อ: 'สมชาย', นามสกุล: 'รักชาติ', [uploadType === 'salary' ? 'ยอดเงินเดือน' : 'ยอดเบี้ยเลี้ยง']: 0 }];

      if (data.personnel && data.personnel.length > 0) {
        // กรองเอาเฉพาะ "พลฯ"
        const listToUse = data.personnel.filter((p: any) => p.rank.includes('พลฯ') || p.rank.includes('พลทหาร'));
        const amountHeader = uploadType === 'salary' ? 'ยอดเงินเดือน' : 'ยอดเบี้ยเลี้ยง';

        templateData = listToUse.map((p: any) => ({
          ชื่อ: p.firstName,
          นามสกุล: p.lastName,
          [amountHeader]: 0
        }));
      }

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'Payment_Template.xlsx');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการสร้างเทมเพลต', 'error');
    }
  };

  const confirmDeleteBatch = (prefix: string) => {
    setConfirmBatchPrefix(prefix);
  };

  const executeDeleteBatch = async () => {
    if (!confirmBatchPrefix) return;
    if (!cancelerName.trim()) {
      showToast('กรุณาระบุชื่อผู้ยกเลิกบิลก่อนลบ', 'error');
      return;
    }
    const batchPrefix = confirmBatchPrefix;
    setConfirmBatchPrefix(null);

    try {
      const res = await fetch(`/api/payments?batchPrefix=${encodeURIComponent(batchPrefix)}&canceledBy=${encodeURIComponent(cancelerName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed');
      showToast('ลบบิลทั้งชุดสำเร็จ', 'success');
      fetchRecords();
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการลบชุดข้อมูล', 'error');
    }
  };

  const batches = useMemo(() => {
    const map = new Map<string, { prefix: string, count: number, totalAmount: number, isAllowance: boolean, title: string, issuedBy?: string }>();

    records.forEach(r => {
      const parts = r.id.split('_');
      if (parts.length >= 4) {
        let prefix = '';
        let title = '';
        let isAllowance = false;

        if (parts[3] === 'allowance') {
          prefix = parts.slice(0, 4).join('_');
          title = `เบี้ยเลี้ยง ${parts[2]} (${parts[1]}/${parts[0]})`;
          isAllowance = true;
        } else if (parts[2] === 'salary') {
          prefix = parts.slice(0, 3).join('_');
          title = `เงินเดือน (${parts[1]}/${parts[0]})`;
        }

        if (prefix) {
          if (!map.has(prefix)) {
            map.set(prefix, { prefix, count: 0, totalAmount: 0, isAllowance, title, issuedBy: (r as any).issuedBy });
          }
          const b = map.get(prefix)!;
          b.count += 1;
          b.totalAmount += (r.payableAmount !== undefined ? r.payableAmount : r.amount);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.prefix.localeCompare(a.prefix));
  }, [records]);

  const totalBatchPages = Math.ceil(batches.length / batchItemsPerPage);
  const paginatedBatches = batches.slice((batchCurrentPage - 1) * batchItemsPerPage, batchCurrentPage * batchItemsPerPage);

  const latestPeriod = useMemo(() => {
    if (records.length === 0) return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

    const maxRecord = records.reduce((max, r) => {
      const val = r.year * 100 + r.month;
      const maxVal = max.year * 100 + max.month;
      return val > maxVal ? r : max;
    });
    return { month: maxRecord.month, year: maxRecord.year };
  }, [records]);

  const currentMonth = latestPeriod.month;
  const currentYear = latestPeriod.year;

  const displayRecords = activeTab === 'latest'
    ? records.filter(r => r.month === currentMonth && r.year === currentYear)
    : records;

  const displayBatches = useMemo(() => {
    const map = new Map<string, string>();
    displayRecords.forEach(r => {
      const parts = r.id.split('_');
      if (parts.length >= 4) {
        if (parts[3] === 'allowance') {
          map.set(parts.slice(0, 4).join('_'), `เบี้ยเลี้ยง ${parts[2]} (${parts[1]}/${parts[0]})`);
        } else if (parts[2] === 'salary') {
          map.set(parts.slice(0, 3).join('_'), `เงินเดือน (${parts[1]}/${parts[0]})`);
        }
      }
    });
    return Array.from(map.entries()).map(([prefix, title]) => ({ prefix, title }));
  }, [displayRecords]);

  const filteredRecords = useMemo(() => {
    const filtered = displayRecords.filter(r => {
      const matchSearch = (r.firstName + ' ' + r.lastName).toLowerCase().includes(searchQuery.toLowerCase());
      let matchCategory = false;
      if (categoryFilter === 'mule') {
        matchCategory = (r as any).isMuleAccount === true;
      } else {
        if ((r as any).isMuleAccount) {
          matchCategory = false;
        } else {
          matchCategory = categoryFilter === 'all' || r.paymentType === categoryFilter;
        }
      }

      let matchBatch = true;
      if (batchFilter !== 'all') {
        const parts = r.id.split('_');
        let prefix = '';
        if (parts.length >= 4 && parts[3] === 'allowance') {
          prefix = parts.slice(0, 4).join('_');
        } else if (parts.length >= 3 && parts[2] === 'salary') {
          prefix = parts.slice(0, 3).join('_');
        }
        matchBatch = prefix === batchFilter;
      }
      return matchSearch && matchCategory && matchBatch;
    });

    const unpaid = filtered.filter(r => !r.isPaid);
    const paid = filtered.filter(r => r.isPaid);

    return [...unpaid, ...paid];
  }, [displayRecords, searchQuery, categoryFilter, batchFilter]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const payableRecords = filteredRecords.filter(r => (r.payableAmount !== undefined ? r.payableAmount : r.amount) > 0);
  const totalRecords = payableRecords.length;
  const paidRecords = payableRecords.filter(r => r.isPaid).length;
  const totalAmount = filteredRecords.reduce((sum, r) => sum + (r.payableAmount !== undefined ? r.payableAmount : r.amount), 0);
  const paidAmount = filteredRecords.filter(r => r.isPaid).reduce((sum, r) => sum + (r.payableAmount !== undefined ? r.payableAmount : r.amount), 0);
  const unpaidAmount = totalAmount - paidAmount;
  const progressPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return (
    <div className="page-container">
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

      <header className="header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="header-title" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
            BK100 Payroll
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} title="ออกจากระบบ" style={{ padding: '8px', borderRadius: '50%', color: 'var(--danger)', background: 'rgba(220,38,38,0.1)' }}>
            <LogOut size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
          <button className="btn btn-ghost" onClick={() => router.push('/allowance')} title="คำนวณเบี้ยเลี้ยง" style={{ padding: '8px', borderRadius: '50%', color: 'var(--primary)', background: 'var(--surface)', flexShrink: 0 }}>
            <Calculator size={18} />
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/salary')} title="สร้างเงินเดือน" style={{ padding: '8px', borderRadius: '50%', color: 'var(--primary)', background: 'var(--surface)', flexShrink: 0 }}>
            <Banknote size={18} />
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/dashboard')} title="หน้าสรุปข้อมูล (Dashboard)" style={{ padding: '8px', borderRadius: '50%', background: 'var(--surface)', flexShrink: 0 }}>
            <BarChart2 size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', borderRadius: '99px', border: '1px solid var(--border)', overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value as any)}
              className="custom-select"
              style={{ padding: '8px 4px 8px 10px', border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, color: 'var(--primary)', flex: 1, minWidth: 0, textOverflow: 'ellipsis' }}
            >
              <option value="salary">เงินเดือน</option>
              <option value="allowance">เบี้ยเลี้ยง</option>
            </select>
            <button className="btn btn-ghost" onClick={downloadTemplate} title={`โหลดเทมเพลต ${uploadType === 'salary' ? 'เงินเดือน' : 'เบี้ยเลี้ยง'}`} style={{ padding: '8px 10px', border: 'none', borderLeft: '1px solid var(--border)', borderRadius: 0, flexShrink: 0 }}>
              <Download size={18} />
            </button>
          </div>

          <input
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 12px', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.9rem' }}>
            <Upload size={16} style={{ marginRight: 4 }} />
            นำเข้า
          </button>
        </div>
      </header>

      <main className="content animate-fade-in">
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'latest' ? 'active' : ''}`}
            onClick={() => setActiveTab('latest')}
          >
            รอบปัจจุบัน
          </div>
          <div
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            ประวัติทั้งหมด
          </div>
          <div
            className={`tab ${activeTab === 'batches' ? 'active' : ''}`}
            onClick={() => setActiveTab('batches')}
          >
            ประวัติการสร้าง
          </div>
        </div>

        {/* Dashboard Card */}
        {activeTab !== 'batches' && (
          <div className="card dashboard-card" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9, letterSpacing: '0.5px' }}>
                  {activeTab === 'latest' ? `สรุปยอดเงินเดือนนี้ (${format(new Date(), 'MMM yy', { locale: th })})` : 'สรุปยอดเงินย้อนหลังทั้งหมด'}
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 700, margin: '8px 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  ฿{paidAmount.toLocaleString()}
                  <span style={{ fontSize: '1.1rem', opacity: 0.7, fontWeight: 500 }}>/ {totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="progress-bg" style={{ margin: '16px 0 12px 0' }}>
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>

            <div className="flex-between" style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: 500 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'white' }}></span>
                จ่ายแล้ว: {paidRecords} / {totalRecords} บิล
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }}></span>
                ค้างจ่าย: ฿{unpaidAmount.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'batches' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            {paginatedBatches.map(b => (
              <div key={b.prefix} className="card flex-between" style={{ padding: '20px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <div>จำนวน {b.count} รายการ • ยอดรวม ฿{b.totalAmount.toLocaleString()}</div>
                    {b.issuedBy && <div style={{ marginTop: '2px' }}>ผู้ออกบิล: {b.issuedBy}</div>}
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => confirmDeleteBatch(b.prefix)}
                  style={{ padding: '8px 16px', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                >
                  ยกเลิกบิลชุดนี้
                </button>
              </div>
            ))}
            {batches.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                ไม่มีประวัติการสร้างบิล
              </div>
            )}
            {/* Pagination Controls for Batches */}
            {totalBatchPages > 1 && (
              <div className="flex-between" style={{ padding: '16px 0', marginTop: '8px' }}>
                <button
                  className="btn btn-ghost"
                  disabled={batchCurrentPage === 1}
                  onClick={() => setBatchCurrentPage(p => p - 1)}
                  style={{ padding: '8px', opacity: batchCurrentPage === 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={18} />
                </button>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  หน้า {batchCurrentPage} / {totalBatchPages}
                </div>
                <button
                  className="btn btn-ghost"
                  disabled={batchCurrentPage === totalBatchPages}
                  onClick={() => setBatchCurrentPage(p => p + 1)}
                  style={{ padding: '8px', opacity: batchCurrentPage === totalBatchPages ? 0.5 : 1 }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Category Filter */}
            <div className="category-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', background: 'rgba(255,255,255,0.4)', padding: '4px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              <button className={`btn ${categoryFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setCategoryFilter('all'); setBatchFilter('all'); }} style={{ flex: '1 1 auto', padding: '6px', fontSize: '0.85rem', border: 'none', whiteSpace: 'nowrap' }}>ปกติทั้งหมด</button>
              <button className={`btn ${categoryFilter === 'salary' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setCategoryFilter('salary'); setBatchFilter('all'); }} style={{ flex: '1 1 auto', padding: '6px', fontSize: '0.85rem', border: 'none', whiteSpace: 'nowrap' }}>เงินเดือน</button>
              <button className={`btn ${categoryFilter === 'allowance' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setCategoryFilter('allowance'); setBatchFilter('all'); }} style={{ flex: '1 1 auto', padding: '6px', fontSize: '0.85rem', border: 'none', whiteSpace: 'nowrap' }}>เบี้ยเลี้ยง</button>
              <button className={`btn ${categoryFilter === 'mule' ? 'btn-danger' : 'btn-ghost-danger'}`} onClick={() => { setCategoryFilter('mule'); setBatchFilter('all'); }} style={{ flex: '1 1 auto', padding: '6px', fontSize: '0.85rem', border: 'none', whiteSpace: 'nowrap' }}>บัญชีม้า</button>
            </div>

            {/* Batch Filter Dropdown */}
            {displayBatches.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <select
                  value={batchFilter}
                  onChange={e => setBatchFilter(e.target.value)}
                  className="custom-select custom-select-dark"
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.9rem', outline: 'none', color: 'var(--text-primary)', fontWeight: 500 }}
                >
                  <option value="all">ดูทุกบิลรวมกัน</option>
                  {displayBatches.map(b => (
                    <option key={b.prefix} value={b.prefix}>{b.title}</option>
                  ))}
                </select>
              </div>
            )}


            {/* Search Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="ค้นหาชื่อกำลังพล..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '99px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div style={{ marginTop: '12px', fontWeight: 500 }}>กำลังเชื่อมต่อ Google Sheets...</div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <FileSpreadsheet size={48} strokeWidth={1.5} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  ไม่พบข้อมูล
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {paginatedRecords.map((record, idx) => (
                  <div
                    key={record.id}
                    className="card flex-between"
                    onClick={() => router.push(`/history/${encodeURIComponent(record.firstName + ' ' + record.lastName)}`)}
                    style={{
                      padding: '16px 20px',
                      animationDelay: `${idx * 0.03}s`,
                      marginBottom: 0,
                      cursor: 'pointer',
                      opacity: (record as any).isMuleAccount ? 0.6 : 1
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', textDecoration: (record as any).isMuleAccount ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {record.firstName} {record.lastName}
                        {(record as any).isMuleAccount && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--danger-gradient)', color: 'white', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none' }}>บัญชีม้า</span>
                        )}
                        {(record as any).selfWithdrawnAmount > 0 && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--primary-gradient)', color: 'white', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none' }}>
                            หักกดเอง: ฿{(record as any).selfWithdrawnAmount.toLocaleString()}
                          </span>
                        )}
                        {(record as any).otherDeductions > 0 && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--danger)', color: 'white', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none' }}>
                            หักอื่นๆ: ฿{(record as any).otherDeductions.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`badge ${record.paymentType === 'allowance' ? 'badge-primary' : ''}`} style={{ padding: '2px 8px', fontSize: '0.7rem', background: record.paymentType === 'allowance' ? 'var(--primary-gradient)' : 'var(--surface-2)', color: record.paymentType === 'allowance' ? 'white' : 'var(--text-secondary)' }}>
                          {record.paymentType === 'allowance' ? 'เบี้ยเลี้ยง' : 'เงินเดือน'}
                        </span>
                        ยอด: <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>฿{(record.payableAmount !== undefined ? record.payableAmount : record.amount).toLocaleString()}</strong>
                        {(record as any).otherDeductions > 0 && (
                          <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.95rem' }}>
                            (รับเงินสด ฿{((record.payableAmount !== undefined ? record.payableAmount : record.amount) - (record as any).otherDeductions).toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className={`btn badge ${record.isPaid ? 'badge-success' : 'badge-danger'}`}
                        style={{ minWidth: '120px', cursor: 'pointer', display: 'flex', gap: '6px', justifyContent: 'center' }}
                        onClick={(e) => togglePayment(e, record)}
                      >
                        {record.isPaid ? <><CheckCircle size={14} strokeWidth={2.5} /> จ่ายแล้ว{record.paidAt ? ` ${format(new Date(record.paidAt), 'HH:mm')} น.` : ''}</> : <><Circle size={14} strokeWidth={2.5} /> รอการจ่าย</>}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => confirmDeleteRecord(e, record.id)}
                        style={{ padding: '6px', color: 'var(--danger)', border: 'none', background: 'var(--surface)' }}
                        title="ลบบิลนี้"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex-between" style={{ padding: '16px 0', marginTop: '8px' }}>
                    <button
                      className="btn btn-ghost"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      style={{ padding: '8px', opacity: currentPage === 1 ? 0.5 : 1 }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      หน้า {currentPage} / {totalPages}
                    </div>
                    <button
                      className="btn btn-ghost"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      style={{ padding: '8px', opacity: currentPage === totalPages ? 0.5 : 1 }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )
        }
      </main >

      {/* Impeccable Confirmation Modal */}
      {
        confirmBatchPrefix && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="card animate-fade-in" style={{
              width: '100%',
              maxWidth: '420px',
              padding: '32px 24px',
              textAlign: 'center',
              background: 'var(--surface)',
              boxShadow: '0 24px 60px -12px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.4)'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                ยืนยันการยกเลิกบิลชุดนี้
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
                ข้อมูลบิลทั้งหมดในรอบนี้จะถูกลบออกจากระบบอย่างถาวร
              </div>

              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>ชื่อผู้ยกเลิกบิล</label>
                <input
                  type="text"
                  placeholder=""
                  value={cancelerName}
                  onChange={e => {
                    setCancelerName(e.target.value);
                    localStorage.setItem('issuerName', e.target.value);
                  }}
                  className="search-input"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setConfirmBatchPrefix(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={executeDeleteBatch}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--danger)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ยืนยันการลบ
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Confirm Delete Single Record Modal */}
      {
        confirmRecordToDelete && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="card animate-fade-in" style={{
              width: '100%',
              maxWidth: '420px',
              padding: '32px 24px',
              textAlign: 'center',
              background: 'var(--surface)',
              boxShadow: '0 24px 60px -12px rgba(0,0,0,0.15)',
              border: '1px solid rgba(255,255,255,0.4)'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                ยืนยันการลบบิลนี้
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.6' }}>
                บิลนี้จะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้
              </div>

              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>ชื่อผู้ยกเลิกบิล</label>
                <input
                  type="text"
                  placeholder=" "
                  value={cancelerName}
                  onChange={e => {
                    setCancelerName(e.target.value);
                    localStorage.setItem('issuerName', e.target.value);
                  }}
                  className="search-input"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setConfirmRecordToDelete(null)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={executeDeleteRecord}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--danger)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  ยืนยันการลบ
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
