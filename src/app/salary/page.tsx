'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Search, CheckCircle, Settings, X, Banknote } from 'lucide-react';

export default function SalaryCalculator() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [globalBaseSalary, setGlobalBaseSalary] = useState(8100);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [issuerName, setIssuerName] = useState('');

  const [personnel, setPersonnel] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchPersonnel();
    const savedIssuer = localStorage.getItem('issuerName');
    if (savedIssuer) setIssuerName(savedIssuer);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personnel');
      const data = await res.json();
      if (data.personnel && data.personnel.length > 0) {
        const listToUse = data.personnel.filter((p: any) => p.rank.includes('พลฯ') || p.rank.includes('พลทหาร'));
        const initialData = listToUse.map((p: any) => ({
          ...p,
          baseSalaryInput: '',
          deductionsInput: '',
          isMuleAccount: p.isMuleAccount || false,
        }));
        setPersonnel(initialData);
      }
    } catch (err) {
      showToast('ไม่สามารถดึงข้อมูลกำลังพลได้', 'error');
    }
    setLoading(false);
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const applyGlobalBaseSalary = () => {
    setPersonnel(prev => prev.map(p => ({
      ...p,
      baseSalaryInput: globalBaseSalary.toString()
    })));
    setShowSettingsModal(false);
    showToast(`ตั้งฐานเงินเดือน ${globalBaseSalary.toLocaleString()} บาทสำเร็จ`, 'success');
  };

  const handleInputChange = (personId: string, field: 'baseSalaryInput' | 'deductionsInput', value: string) => {
    if (!/^\d*$/.test(value)) return;
    setPersonnel(prev => prev.map(p => p.id === personId ? { ...p, [field]: value } : p));
  };

  const handleSaveClick = () => {
    if (personnel.length === 0) return;
    setConfirmSave(true);
  };

  const executeSave = async () => {
    if (!issuerName.trim()) {
      showToast('กรุณาระบุชื่อผู้ออกบิลก่อนบันทึก (ตั้งค่าที่มุมขวาบน)', 'error');
      setConfirmSave(false);
      return;
    }

    setConfirmSave(false);
    setSaving(true);

    try {
      const newRecords = [];

      for (const p of personnel) {
        const base = Number(p.baseSalaryInput) || 0;
        const deductions = Number(p.deductionsInput) || 0;

        if (base > 0) {
          const netAmount = Math.max(0, base - deductions);
          const payableAmount = netAmount;

          const recId = `${year}_${month}_salary_${p.firstName}_${p.lastName}`.replace(/\s+/g, '');
          newRecords.push({
            id: recId,
            month: month,
            year: year,
            firstName: p.firstName,
            lastName: p.lastName,
            amount: base,
            payableAmount: payableAmount,
            rolloverAmount: 0,
            paymentType: 'salary',
            isPaid: payableAmount === 0,
            isMuleAccount: p.isMuleAccount,
            selfWithdrawnAmount: 0,
            otherDeductions: deductions,
            previousRollover: 0,
            personId: p.id,
            issuedBy: issuerName
          });
        }
      }

      if (newRecords.length === 0) {
        showToast('ไม่มีข้อมูลเงินเดือนที่ต้องบันทึก', 'error');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: newRecords })
      });

      if (!res.ok) throw new Error('Failed');

      showToast(`บันทึกเงินเดือน ${month}/${year} สำเร็จ!`, 'success');

      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
      setSaving(false);
    }
  };

  const filteredPersonnel = personnel.filter(p => {
    return (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredPersonnel.length / itemsPerPage);
  const paginatedPersonnel = filteredPersonnel.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalBase = personnel.reduce((sum, p) => sum + (Number(p.baseSalaryInput) || 0), 0);
  const totalDeductions = personnel.reduce((sum, p) => sum + (Number(p.deductionsInput) || 0), 0);
  const totalNet = personnel.reduce((sum, p) => sum + Math.max(0, (Number(p.baseSalaryInput) || 0) - (Number(p.deductionsInput) || 0)), 0);

  return (
    <div className="page-container" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
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

      <header className="flex-between" style={{ marginBottom: '24px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => router.back()}
          style={{ padding: '8px 16px', background: 'var(--surface)' }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', textAlign: 'center', flex: 1 }}>
          สร้างเงินเดือน
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setShowSettingsModal(true)}
          style={{ padding: '8px', color: 'var(--text-secondary)' }}
          title="ตั้งค่าเดือน/ปี"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>รวมเงินเดือนตั้งต้น</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>฿{totalBase.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '16px', marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>รวมหักอื่นๆ</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>฿{totalDeductions.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '16px', marginBottom: 0, textAlign: 'center', background: 'var(--primary-gradient)' }}>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>ยอดคงรับรวม</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>฿{totalNet.toLocaleString()}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="ค้นหาชื่อ..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="search-input"
          style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>กำลังโหลดข้อมูล...</div>
      ) : personnel.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ไม่พบข้อมูลกำลังพล</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {paginatedPersonnel.map(p => {
            const base = Number(p.baseSalaryInput) || 0;
            const deductions = Number(p.deductionsInput) || 0;
            const net = Math.max(0, base - deductions);

            return (
              <div key={p.id} className="card animate-fade-in" style={{ padding: '20px', marginBottom: 0, borderLeft: p.isMuleAccount ? '4px solid var(--danger)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {p.firstName} {p.lastName}
                      {p.isMuleAccount && <span className="badge badge-danger">บัญชีม้า</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>เงินเดือน (บาท)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={p.baseSalaryInput}
                      onChange={e => handleInputChange(p.id, 'baseSalaryInput', e.target.value)}
                      placeholder="0"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', outline: 'none', fontSize: '1rem', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>หักอื่นๆ (บาท)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={p.deductionsInput}
                      onChange={e => handleInputChange(p.id, 'deductionsInput', e.target.value)}
                      placeholder="0"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', outline: 'none', fontSize: '1rem', color: 'var(--danger)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--background)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ยอดคงรับ</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: p.isMuleAccount ? 'var(--danger)' : 'var(--success)' }}>
                    ฿{net.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex-between" style={{ padding: '24px 0 100px 0' }}>
          <button
            className="btn btn-ghost"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            style={{ padding: '8px 16px', opacity: currentPage === 1 ? 0.3 : 1 }}
          >
            ก่อนหน้า
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            หน้าที่ {currentPage} / {totalPages}
          </span>
          <button
            className="btn btn-ghost"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            style={{ padding: '8px 16px', opacity: currentPage === totalPages ? 0.3 : 1 }}
          >
            ถัดไป
          </button>
        </div>
      )}

      {/* Floating Save Button */}
      {!loading && personnel.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, width: '100%', maxWidth: '400px', padding: '0 20px' }}>
          <button
            className="btn btn-primary"
            onClick={handleSaveClick}
            disabled={saving || totalBase === 0}
            style={{ width: '100%', padding: '16px', borderRadius: '99px', fontSize: '1.05rem', boxShadow: '0 12px 24px rgba(59,130,246,0.3)', display: 'flex', justifyContent: 'center', gap: '8px' }}
          >
            {saving ? 'กำลังบันทึก...' : <><Save size={20} /> บันทึกเงินเดือน</>}
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', background: 'var(--surface)', padding: 0, overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>ตั้งค่าการสร้างเงินเดือน</div>
              <button onClick={() => setShowSettingsModal(false)} className="btn btn-ghost" style={{ padding: '8px', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>ฐานเงินเดือนเริ่มต้น</label>
                <input
                  type="number"
                  value={globalBaseSalary}
                  onChange={e => setGlobalBaseSalary(Number(e.target.value))}
                  className="search-input"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }}
                />
                {/* <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>ใช้ปุ่ม "ใช้กับทุกคน" ด้านล่าง เพื่อเติมค่านี้ให้กับทุกคน</p> */}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>เดือน</label>
                  <select value={month} onChange={e => setMonth(Number(e.target.value))} className="custom-select custom-select-dark" style={{ width: '100%', padding: '12px' }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>เดือน {m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>ปี</label>
                  <input
                    type="number"
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="search-input"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowSettingsModal(false)} style={{ padding: '10px 20px' }}>ปิด</button>
              <button className="btn btn-primary" onClick={applyGlobalBaseSalary} style={{ padding: '10px 20px' }}>ใช้กับทุกคน</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Save Modal */}
      {confirmSave && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', boxShadow: '0 24px 60px -12px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              ยืนยันบันทึกเงินเดือน
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>
              เมื่อบันทึกแล้ว ข้อมูลจะถูกส่งไปยังระบบและแสดงผลในหน้าหลักทันที
            </div>

            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>ชื่อผู้ออกบิล</label>
              <input
                type="text"
                placeholder=" "
                value={issuerName}
                onChange={e => {
                  setIssuerName(e.target.value);
                  localStorage.setItem('issuerName', e.target.value);
                }}
                className="search-input"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmSave(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>ย้อนกลับ</button>
              <button onClick={executeSave} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--primary-gradient)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>ยืนยันบันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
