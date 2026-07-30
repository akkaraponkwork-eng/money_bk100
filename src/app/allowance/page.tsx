'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calculator, Save, Search, CheckCircle, Settings, X } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';
import { th } from 'date-fns/locale';

export default function AllowanceCalculator() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuerName, setIssuerName] = useState('');
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [confirmClearLeavesId, setConfirmClearLeavesId] = useState<string | null>(null);
  const [confirmMuleAction, setConfirmMuleAction] = useState<{ personId: string, currentStatus: boolean, name: string } | null>(null);

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [baseRate, setBaseRate] = useState(Number(process.env.NEXT_PUBLIC_DEFAULT_BASE_RATE) || 120);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<1 | 2 | 3>(1);

  const getDaysInPeriod = (y: number, m: number, p: 1 | 2 | 3): Date[] => {
    const days: Date[] = [];
    if (p === 1) {
      for (let i = 1; i <= 10; i++) days.push(new Date(y, m - 1, i));
    } else if (p === 2) {
      for (let i = 11; i <= 25; i++) days.push(new Date(y, m - 1, i));
    } else if (p === 3) {
      const lastDayOfMonth = getDaysInMonth(new Date(y, m - 1));
      for (let i = 26; i <= lastDayOfMonth; i++) days.push(new Date(y, m - 1, i));

      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? y + 1 : y;
      let payday = new Date(nextYear, nextMonth - 1, 7);
      if (payday.getDay() === 6) payday.setDate(9);
      else if (payday.getDay() === 0) payday.setDate(8);

      for (let i = 1; i <= payday.getDate(); i++) {
        days.push(new Date(nextYear, nextMonth - 1, i));
      }
    }
    return days;
  };

  const periodDays = useMemo(() => getDaysInPeriod(year, month, period), [year, month, period]);
  const formatDateKey = (d: Date) => format(d, 'yyyy-MM-dd');
  const todayStr = formatDateKey(new Date());

  // Personnel state: leaveMap is now Record<string, boolean> where string is yyyy-MM-dd
  const [personnel, setPersonnel] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'leave' | 'mule'>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Blacklist Manager state
  const [showBlacklistPopup, setShowBlacklistPopup] = useState(false);
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [updatingBlacklist, setUpdatingBlacklist] = useState<string | null>(null);

  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionMode, setDeductionMode] = useState<'none' | 'all' | 'individual'>('none');
  const [globalDeduction, setGlobalDeduction] = useState<number>(0);

  useEffect(() => {
    fetchPersonnel();
    const savedIssuer = localStorage.getItem('issuerName');
    if (savedIssuer) setIssuerName(savedIssuer);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMode, period]);

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personnel');
      const data = await res.json();
      if (data.personnel && data.personnel.length > 0) {
        const listToUse = data.personnel.filter((p: any) => p.rank.includes('พลฯ') || p.rank.includes('พลทหาร'));

        const initialData = listToUse.map((p: any) => ({
          ...p,
          leaveMap: {} as Record<string, boolean>,
          isMuleAccount: p.isMuleAccount || false,
          remainingBalanceInput: '',
          otherDeductionsInput: 0,
          selectionStart: null
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

  const handleDayTap = (personId: string, dateObj: Date) => {
    const dayStr = formatDateKey(dateObj);
    const tappedIndex = periodDays.findIndex(d => formatDateKey(d) === dayStr);
    if (tappedIndex === -1) return;

    setPersonnel(prev => prev.map(p => {
      if (p.id === personId && !p.isMuleAccount) {
        if (p.selectionStart !== null) {
          const startIndex = periodDays.findIndex(d => formatDateKey(d) === p.selectionStart);
          if (startIndex === -1) return { ...p, selectionStart: null };

          const start = Math.min(startIndex, tappedIndex);
          const end = Math.max(startIndex, tappedIndex);
          const targetState = p.leaveMap[p.selectionStart];

          const newLeaveMap = { ...p.leaveMap };
          for (let i = start; i <= end; i++) {
            newLeaveMap[formatDateKey(periodDays[i])] = targetState;
          }

          return { ...p, leaveMap: newLeaveMap, selectionStart: null };
        } else {
          const newState = !p.leaveMap[dayStr];
          return {
            ...p,
            leaveMap: { ...p.leaveMap, [dayStr]: newState },
            selectionStart: dayStr
          };
        }
      }
      return p;
    }));
  };

  const confirmClearLeaves = (personId: string) => {
    setConfirmClearLeavesId(personId);
  };

  const executeClearLeaves = () => {
    if (!confirmClearLeavesId) return;
    setPersonnel(prev => prev.map(p => p.id === confirmClearLeavesId ? { ...p, leaveMap: {}, selectionStart: null } : p));
    setConfirmClearLeavesId(null);
  };

  const confirmToggleBlacklist = (personId: string, currentStatus: boolean, firstName: string, lastName: string) => {
    setConfirmMuleAction({ personId, currentStatus, name: `${firstName} ${lastName}` });
  };

  const executeToggleBlacklist = async () => {
    if (!confirmMuleAction) return;
    const { personId, currentStatus, name } = confirmMuleAction;
    setConfirmMuleAction(null);
    setUpdatingBlacklist(personId);
    try {
      const res = await fetch('/api/personnel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, isMuleAccount: !currentStatus })
      });
      if (res.ok) {
        setPersonnel(prev => prev.map(p => p.id === personId ? { ...p, isMuleAccount: !currentStatus, leaveMap: {} } : p));
        showToast(!currentStatus ? 'เพิ่มบัญชีม้าแล้ว' : 'ยกเลิกบัญชีม้าแล้ว', 'success');
      } else {
        throw new Error('Failed');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการอัปเดต', 'error');
    }
    setUpdatingBlacklist(null);
  };

  const handleSaveClick = () => {
    if (personnel.length === 0) return;
    setShowDeductionModal(true);
  };

  const executeSave = async () => {
    if (personnel.length === 0) return;
    if (!issuerName.trim()) {
      showToast('กรุณาระบุชื่อผู้ออกบิล', 'error');
      return;
    }
    setSaving(true);
    setShowDeductionModal(false);

    try {
      const newRecords = [];
      const rolloverUpdates = [];

      for (const p of personnel) {

        const validPeriodDays = periodDays.filter(d => formatDateKey(d) <= todayStr);
        const leaveCount = validPeriodDays.filter(d => p.leaveMap[formatDateKey(d)]).length;
        const netDays = Math.max(0, validPeriodDays.length - leaveCount);
        const amount = netDays * baseRate;
        const totalAmount = amount + (p.rolloverBalance || 0);

        if (totalAmount > 0) {
          const remainingInputStr = p.remainingBalanceInput;
          const selfWithdrawnAmount = remainingInputStr !== undefined && remainingInputStr !== ''
            ? Math.max(0, totalAmount - Number(remainingInputStr))
            : 0;

          const otherDeductions = deductionMode === 'all'
            ? globalDeduction
            : (deductionMode === 'individual' ? (p.otherDeductionsInput || 0) : 0);

          const netAmountAfterDeduction = Math.max(0, totalAmount - selfWithdrawnAmount - otherDeductions);
          const payableAmount = p.isMuleAccount ? netAmountAfterDeduction : Math.floor(netAmountAfterDeduction / 100) * 100;
          const newRollover = p.isMuleAccount ? 0 : netAmountAfterDeduction - payableAmount;

          const recId = `${year}_${month}_รอบ${period}_allowance_${p.firstName}_${p.lastName}`.replace(/\s+/g, '');
          newRecords.push({
            id: recId,
            month: month,
            year: year,
            firstName: p.firstName,
            lastName: p.lastName,
            amount: totalAmount,
            payableAmount: payableAmount,
            rolloverAmount: newRollover,
            paymentType: 'allowance',
            isPaid: payableAmount === 0,
            isMuleAccount: p.isMuleAccount,
            selfWithdrawnAmount: selfWithdrawnAmount,
            otherDeductions: otherDeductions,
            previousRollover: p.rolloverBalance || 0,
            personId: p.id,
            issuedBy: issuerName
          });

          rolloverUpdates.push({
            personId: p.id,
            rolloverBalance: newRollover
          });
        }
      }

      if (newRecords.length === 0) {
        showToast('ไม่มียอดเงินที่ต้องจ่ายในรอบนี้', 'error');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: newRecords })
      });

      if (res.ok) {
        // อัปเดตยอดทบกลับไปที่ Google Sheets (Personnel)
        if (rolloverUpdates.length > 0) {
          await fetch('/api/personnel', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: rolloverUpdates })
          });
        }

        showToast(`บันทึกบิลรอบ ${period} สำเร็จ!`, 'success');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
      setSaving(false);
    }
  };

  const totalLeaveDays = personnel.reduce((sum, p) => {
    if (p.isMuleAccount) return sum;
    const validPeriodDays = periodDays.filter(d => formatDateKey(d) <= todayStr);
    return sum + validPeriodDays.filter(d => p.leaveMap[formatDateKey(d)]).length;
  }, 0);

  const totalBudget = personnel.reduce((sum, p) => {
    if (p.isMuleAccount) return sum;
    const validPeriodDays = periodDays.filter(d => formatDateKey(d) <= todayStr);
    const leaveCount = validPeriodDays.filter(d => p.leaveMap[formatDateKey(d)]).length;
    const currentAmount = Math.max(0, validPeriodDays.length - leaveCount) * baseRate;
    const totalAmount = currentAmount + (p.rolloverBalance || 0);

    const remainingInputStr = p.remainingBalanceInput;
    const selfWithdrawnAmount = remainingInputStr !== undefined && remainingInputStr !== ''
      ? Math.max(0, totalAmount - Number(remainingInputStr))
      : 0;

    // otherDeductions doesn't apply to totalBudget preview because it's set in the modal
    // but if the user chose it in the modal, we don't recalculate totalBudget on the fly there (it's covered in modal).
    // Actually, we don't know the deductionMode in totalBudget if they haven't opened modal yet.
    // So totalBudget here remains without otherDeductions.

    const netAmountAfterDeduction = Math.max(0, totalAmount - selfWithdrawnAmount);
    const payableAmount = Math.floor(netAmountAfterDeduction / 100) * 100;

    return sum + payableAmount;
  }, 0);

  const filteredPersonnel = useMemo(() => {
    return personnel.filter(p => {
      const matchSearch = (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchQuery.toLowerCase());
      let matchFilter = true;
      if (filterMode === 'leave') {
        const validPeriodDays = periodDays.filter(d => formatDateKey(d) <= todayStr);
        const leaveCount = validPeriodDays.filter(d => p.leaveMap[formatDateKey(d)]).length;
        matchFilter = leaveCount > 0;
      } else if (filterMode === 'mule') {
        matchFilter = p.isMuleAccount === true;
      }
      return matchSearch && matchFilter;
    });
  }, [personnel, searchQuery, filterMode, periodDays, todayStr]);

  const totalPages = Math.ceil(filteredPersonnel.length / itemsPerPage);
  const paginatedPersonnel = filteredPersonnel.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const blacklistSearchResults = personnel.filter(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(blacklistSearch.toLowerCase()));

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
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={20} /> เครื่องมือคำนวณเบี้ยเลี้ยง
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowSettingsModal(true)}
            style={{ padding: '8px 12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)' }}
            title="ตั้งค่ารอบเบี้ยเลี้ยง"
          >
            <Settings size={18} /> ตั้งค่า
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setShowBlacklistPopup(true)}
            style={{ padding: '8px 12px', color: 'var(--danger)', background: '#fee2e2' }}
            title="จัดการบัญชีม้า"
          >
            บัญชีม้า
          </button>
        </div>
      </header>

      {/* Current Settings Summary */}
      <div className="card animate-fade-in flex-between" style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '24px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }} onClick={() => setShowSettingsModal(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Calculator size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>รอบเบี้ยเลี้ยงปัจจุบัน</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              รอบ {period} • {format(new Date(2000, month - 1, 1), 'MMMM', { locale: th })} {year}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>เรทต่อวัน</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
            ฿{baseRate}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>กำลังดึงรายชื่อกำลังพล...</div>
      ) : personnel.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>ไม่พบรายชื่อในระบบ</div>
      ) : (
        <div className="animate-fade-in" style={{ paddingBottom: '100px' }}>

          {/* Search and Filters */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', position: 'relative' }}>
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

            <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
              <button
                className={`btn ${filterMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterMode('all')}
                style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '99px', border: filterMode === 'all' ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap' }}
              >
                แสดงทั้งหมด ({personnel.length})
              </button>
              <button
                className={`btn ${filterMode === 'leave' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterMode('leave')}
                style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '99px', border: filterMode === 'leave' ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap' }}
              >
                แสดงคนลา ({personnel.filter(p => {
                  const validPeriodDays = periodDays.filter(d => formatDateKey(d) <= todayStr);
                  return validPeriodDays.some(d => p.leaveMap[formatDateKey(d)]);
                }).length})
              </button>
              <button
                className={`btn ${filterMode === 'mule' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilterMode('mule')}
                style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '99px', border: filterMode === 'mule' ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap' }}
              >
                บัญชีม้า ({personnel.filter(p => p.isMuleAccount).length})
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {paginatedPersonnel.map(p => {
              const validPeriodDays = periodDays.filter(d => formatDateKey(d) <= todayStr);
              const leaveCount = validPeriodDays.filter(d => p.leaveMap[formatDateKey(d)]).length;

              const currentAmount = Math.max(0, validPeriodDays.length - leaveCount) * baseRate;
              const totalAmount = currentAmount + (p.rolloverBalance || 0);

              const remainingInputStr = p.remainingBalanceInput;
              const selfWithdrawnAmount = remainingInputStr !== undefined && remainingInputStr !== ''
                ? Math.max(0, totalAmount - Number(remainingInputStr))
                : 0;

              const netAmountAfterDeduction = Math.max(0, totalAmount - selfWithdrawnAmount);
              const payableAmount = p.isMuleAccount ? 0 : Math.floor(netAmountAfterDeduction / 100) * 100;
              const newRollover = p.isMuleAccount ? 0 : netAmountAfterDeduction - payableAmount;

              return (
                <div key={p.id} className="card" style={{ padding: '16px', opacity: p.isMuleAccount ? 0.7 : 1, background: p.isMuleAccount ? 'var(--background)' : 'white' }}>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', textDecoration: p.isMuleAccount ? 'line-through' : 'none' }}>
                        {p.firstName} {p.lastName}
                      </div>
                      {p.isMuleAccount && (
                        <div style={{ fontSize: '0.8rem', color: 'white', background: 'var(--danger-gradient)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                          บัญชีม้า
                        </div>
                      )}
                      {!p.isMuleAccount && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ยอดคงเหลือ:</span>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', maxWidth: '100px' }}>
                            <span style={{ padding: '4px 8px', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)' }}>฿</span>
                            <input
                              type="number"
                              min="0"
                              max={totalAmount}
                              value={p.remainingBalanceInput !== undefined ? p.remainingBalanceInput : ''}
                              placeholder={totalAmount.toString()}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                setPersonnel(prev => prev.map(pr => pr.id === p.id ? { ...pr, remainingBalanceInput: valStr } : pr));
                              }}
                              style={{ width: '100%', padding: '4px', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ยอดจ่ายตู้</div>
                      <div style={{ fontWeight: 700, fontSize: '1.25rem', color: payableAmount > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                        ฿{payableAmount.toLocaleString()}
                      </div>
                      {!p.isMuleAccount && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {(p.rolloverBalance || 0) > 0 && <span style={{ color: 'var(--success)', marginRight: '4px' }}>+ทบมา {p.rolloverBalance}฿</span>}
                          {newRollover > 0 && <span style={{ color: 'var(--warning)' }}>ยกไป {newRollover}฿</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {p.selectionStart ? (
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>แตะวันสิ้นสุดเพื่อคลุมช่วง</span>
                      ) : (
                        <span>แตะวันเริ่มและสิ้นสุดเพื่อคลุมช่วง</span>
                      )}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {leaveCount > 0 && !p.isMuleAccount && (
                        <button
                          onClick={() => confirmClearLeaves(p.id)}
                          style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          ล้าง
                        </button>
                      )}
                      <span style={{ color: leaveCount > 0 && !p.isMuleAccount ? 'var(--danger)' : 'inherit', fontWeight: leaveCount > 0 ? 600 : 400 }}>
                        {leaveCount > 0 && !p.isMuleAccount ? `ลา ${leaveCount} วัน` : 'อยู่เต็ม'}
                      </span>
                    </div>
                  </div>

                  {/* Wrapped Grid for Days */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {periodDays.map((dateObj, i) => {
                      const dayStr = formatDateKey(dateObj);
                      const dayNum = dateObj.getDate();
                      const isFuture = dayStr > todayStr;
                      const isLeave = p.leaveMap[dayStr] || false;
                      const isSelectedStart = p.selectionStart === dayStr;

                      // Highlight cross-month transitions for period 3
                      const isNewMonth = i > 0 && dayNum === 1;

                      return (
                        <div
                          key={dayStr}
                          onClick={() => { if (!isFuture && !p.isMuleAccount) handleDayTap(p.id, dateObj); }}
                          style={{
                            aspectRatio: '1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            background: p.isMuleAccount ? '#e2e8f0' : (isFuture ? '#f1f5f9' : (isLeave ? '#fee2e2' : 'var(--surface)')),
                            color: p.isMuleAccount ? '#94a3b8' : (isFuture ? '#cbd5e1' : (isLeave ? '#ef4444' : 'var(--text-primary)')),
                            border: isSelectedStart ? '2px solid var(--primary)' : (p.isMuleAccount ? 'none' : (isFuture ? '1px solid #e2e8f0' : (isLeave ? '1px solid #fca5a5' : '1px solid var(--border)'))),
                            cursor: p.isMuleAccount || isFuture ? 'not-allowed' : 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.15s ease',
                            transform: isSelectedStart ? 'scale(1.1)' : (isLeave && !p.isMuleAccount && !isFuture ? 'scale(0.95)' : 'scale(1)'),
                            boxShadow: isSelectedStart ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                            zIndex: isSelectedStart ? 10 : 1,
                            position: 'relative'
                          }}
                        >
                          {dayNum}
                          {isNewMonth && (
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} title="ขึ้นเดือนใหม่" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPersonnel.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              ไม่พบรายชื่อที่ค้นหา
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex-between" style={{ padding: '20px 0', marginTop: '8px', marginBottom: '80px' }}>
              <button
                className="btn btn-ghost"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '8px 16px', background: 'white', borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                หน้าก่อน
              </button>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                หน้า {currentPage} / {totalPages}
              </div>
              <button
                className="btn btn-ghost"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '8px 16px', background: 'white', borderRadius: '8px', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                หน้าถัดไป
              </button>
            </div>
          )}

          {/* Fixed Bottom Action Bar */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'center',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
            zIndex: 100
          }}>
            <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', paddingRight: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>วันลารวม</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: totalLeaveDays > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {totalLeaveDays} วัน
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ยอดจ่ายรวม รอบ {period}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>
                    ฿{totalBudget.toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSaveClick}
                disabled={saving}
                style={{ padding: '12px 20px', fontSize: '1rem', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)' }}
              >
                {saving ? 'กำลังบันทึก...' : <><Save size={18} /> สร้างบิลรอบ {period}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {showDeductionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>หักค่าใช้จ่ายเพิ่มเติม</div>
              {/* <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>คุณต้องการหักค่าใช้จ่ายอื่นๆ</div> */}
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ marginBottom: '24px' }}>
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

              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>ตัวเลือกหักค่าใช้จ่าย</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.4)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button
                  className={`btn ${deductionMode === 'none' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDeductionMode('none')}
                  style={{ flex: 1, padding: '8px 4px', fontSize: '0.85rem', border: 'none' }}
                >
                  ไม่มีหัก
                </button>
                <button
                  className={`btn ${deductionMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDeductionMode('all')}
                  style={{ flex: 1, padding: '8px 4px', fontSize: '0.85rem', border: 'none' }}
                >
                  หักเหมาจ่าย
                </button>
                <button
                  className={`btn ${deductionMode === 'individual' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDeductionMode('individual')}
                  style={{ flex: 1, padding: '8px 4px', fontSize: '0.85rem', border: 'none' }}
                >
                  ระบุรายคน
                </button>
              </div>

              {deductionMode === 'none' && (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                  <CheckCircle size={32} style={{ margin: '0 auto 10px auto', color: 'var(--success)' }} />
                  <div>ระบบจะบันทึกยอดเงินโดยไม่หักค่าใช้จ่ายเพิ่มเติม</div>
                </div>
              )}

              {deductionMode === 'all' && (
                <div style={{ padding: '10px 0' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>ยอดหักเท่ากันทุกคน (บาท)</label>
                  <input
                    type="number"
                    placeholder="ระบุยอดเงินที่ต้องการหัก..."
                    value={globalDeduction || ''}
                    onChange={e => setGlobalDeduction(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--primary)', outline: 'none', fontSize: '1rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>* ระบบจะไม่นำไปหักบัญชีม้า</div>
                </div>
              )}

              {deductionMode === 'individual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>ระบุยอดหักเป็นรายบุคคล (บาท)</div>
                  {personnel.filter(p => !p.isMuleAccount).map(p => (
                    <div key={p.id} className="flex-between" style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {p.firstName} {p.lastName}
                      </div>
                      <input
                        type="number"
                        placeholder="0"
                        value={p.otherDeductionsInput || ''}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setPersonnel(prev => prev.map(item => item.id === p.id ? { ...item, otherDeductionsInput: val } : item));
                        }}
                        style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', outline: 'none', textAlign: 'right' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.9)' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeductionModal(false)}
                style={{ padding: '10px 16px' }}
              >
                กลับไปแก้ไขบิล
              </button>
              <button
                className="btn btn-primary"
                onClick={executeSave}
                disabled={saving}
                style={{ padding: '10px 20px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
              >
                {saving ? 'กำลังบันทึก...' : 'ยืนยันและสร้างบิล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Modal */}
      {showBlacklistPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex-between" style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>จัดการบัญชีม้า</div>
              <button onClick={() => setShowBlacklistPopup(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ..."
                  value={blacklistSearch}
                  onChange={e => setBlacklistSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {blacklistSearchResults.map(p => (
                  <div key={p.id} className="flex-between" style={{ padding: '12px', background: p.isMuleAccount ? '#fee2e2' : 'var(--surface)', borderRadius: '8px', border: p.isMuleAccount ? '1px solid #fca5a5' : '1px solid transparent' }}>
                    <div style={{ fontWeight: 600, color: p.isMuleAccount ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {p.firstName} {p.lastName}
                    </div>
                    <button
                      className={`btn ${p.isMuleAccount ? 'btn-ghost' : 'btn-primary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', background: p.isMuleAccount ? 'white' : 'var(--danger-gradient)', color: p.isMuleAccount ? 'var(--danger)' : 'white' }}
                      onClick={() => confirmToggleBlacklist(p.id, p.isMuleAccount, p.firstName, p.lastName)}
                      disabled={updatingBlacklist === p.id}
                    >
                      {updatingBlacklist === p.id ? 'กำลังบันทึก...' : (p.isMuleAccount ? 'ยกเลิกม้า' : 'ตั้งเป็นม้า')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden', width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', background: 'white' }}>
            <div className="flex-between" style={{ padding: '20px', borderBottom: '1px solid var(--border)', background: 'var(--primary-gradient)', color: 'white' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>ตั้งค่ารอบเบี้ยเลี้ยง</div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>เรทต่อวัน (บาท)</label>
                  <input
                    type="number"
                    value={baseRate}
                    onChange={(e) => setBaseRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1.1rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>เดือน</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="custom-select custom-select-dark"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', outline: 'none', background: 'white' }}
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>{format(new Date(2000, i, 1), 'MMMM', { locale: th })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>ปี</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '1rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>รอบการจ่ายเบี้ยเลี้ยง</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3].map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p as 1 | 2 | 3)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: period === p ? 'none' : '1px solid var(--border)',
                        background: period === p ? 'var(--primary-gradient)' : 'var(--surface)',
                        color: period === p ? 'white' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      รอบ {p}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center', background: 'var(--surface-2)', padding: '8px', borderRadius: '8px' }}>
                  {period === 1 && "คิดเงินตั้งแต่วันที่ 1 - 10"}
                  {period === 2 && "คิดเงินตั้งแต่วันที่ 11 - 25"}
                  {period === 3 && "คิดเงินตั้งแต่วันที่ 26 - วันเงินเดือนออก (หลบเสาร์อาทิตย์)"}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowSettingsModal(false)}
                style={{ padding: '10px 24px' }}
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Leaves Modal */}
      {confirmClearLeavesId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', boxShadow: '0 24px 60px -12px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              ยืนยันการล้างข้อมูล
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
              คุณต้องการล้างข้อมูลการลาที่เลือกไว้ทั้งหมดใช่หรือไม่?
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmClearLeavesId(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>ย้อนกลับ</button>
              <button onClick={executeClearLeaves} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'var(--danger)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>ยืนยันล้างข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Toggle Mule Modal */}
      {confirmMuleAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', boxShadow: '0 24px 60px -12px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              {confirmMuleAction.currentStatus ? 'ยืนยันยกเลิกบัญชีม้า' : 'ยืนยันตั้งเป็นบัญชีม้า'}
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>
              {confirmMuleAction.currentStatus ? `คุณต้องการยกเลิกให้ ${confirmMuleAction.name} เป็นบัญชีม้าใช่หรือไม่?` : `คุณต้องการตั้งให้ ${confirmMuleAction.name} เป็นบัญชีม้าใช่หรือไม่?`}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmMuleAction(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.05)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>ย้อนกลับ</button>
              <button onClick={executeToggleBlacklist} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: confirmMuleAction.currentStatus ? 'var(--primary)' : 'var(--danger)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                {confirmMuleAction.currentStatus ? 'ยืนยันยกเลิกบัญชีม้า' : 'ยืนยันตั้งบัญชีม้า'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
