"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload, FileSpreadsheet, Trash2, CheckCircle, X, Save, Download, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { PaymentRecord } from '@/types';

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const [billType, setBillType] = useState<'salary' | 'allowance'>('salary');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState(1);
  const [issuerName, setIssuerName] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('issuerName');
    if (savedName) setIssuerName(savedName);
  }, []);

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/personnel');
      if (!res.ok) throw new Error('Failed to fetch personnel');
      const data = await res.json();
      
      let templateData = [];
      const personnelList = data.personnel || [];
      const filteredPersonnel = personnelList.filter((p: any) => p.rank && p.rank.includes('พลฯ'));
      
      if (filteredPersonnel.length > 0) {
        templateData = filteredPersonnel.map((p: any) => ({
          'ชื่อ': p.firstName,
          'นามสกุล': p.lastName,
          'ยอดเงิน': 0,
          'หักอื่นๆ': 0,
          'บัญชีม้า (ใช่/ไม่ใช่)': p.isMuleAccount ? 'ใช่' : 'ไม่ใช่'
        }));
      } else {
        templateData = [
          { 'ชื่อ': 'สมชาย', 'นามสกุล': 'ใจดี', 'ยอดเงิน': 15000, 'หักอื่นๆ': 0, 'บัญชีม้า (ใช่/ไม่ใช่)': 'ไม่ใช่' },
          { 'ชื่อ': 'สมหญิง', 'นามสกุล': 'รักเรียน', 'ยอดเงิน': 20000, 'หักอื่นๆ': 500, 'บัญชีม้า (ใช่/ไม่ใช่)': 'ใช่' }
        ];
      }

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, "bill_template.xlsx");
    } catch (err) {
      showToast('ไม่สามารถดึงข้อมูลรายชื่อได้', 'error');
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setParsedData(jsonData);
      } catch (err) {
        showToast('รูปแบบไฟล์ไม่ถูกต้อง', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (parsedData.length === 0) {
      showToast('ไม่มีข้อมูลให้บันทึก', 'error');
      return;
    }
    if (!issuerName.trim()) {
      showToast('กรุณาระบุชื่อผู้ออกบิล', 'error');
      return;
    }

    setSaving(true);
    try {
      const records: PaymentRecord[] = parsedData.map((row) => {
        const firstNameKey = Object.keys(row).find(k => k.includes('ชื่อ') || k.toLowerCase().includes('first') || k.toLowerCase() === 'name');
        const lastNameKey = Object.keys(row).find(k => k.includes('สกุล') || k.toLowerCase().includes('last') || k.toLowerCase().includes('sur'));
        const amountKey = Object.keys(row).find(k => (k.includes('เงิน') || k.includes('ยอด') || k.toLowerCase().includes('amount')) && !k.includes('หัก'));
        const deductionKey = Object.keys(row).find(k => k.includes('หัก') || k.toLowerCase().includes('deduct'));
        const muleKey = Object.keys(row).find(k => k.includes('ม้า') || k.toLowerCase().includes('mule'));

        const firstName = String(firstNameKey ? row[firstNameKey] : '').trim();
        const lastName = String(lastNameKey ? row[lastNameKey] : '').trim();
        const amount = Number(amountKey ? row[amountKey] : 0) || 0;
        const otherDeductions = Number(deductionKey ? row[deductionKey] : 0) || 0;
        
        const muleRaw = String(muleKey ? row[muleKey] : '').trim().toLowerCase();
        const isMuleAccount = muleRaw === 'ใช่' || muleRaw === 'true' || muleRaw === 'y' || muleRaw === 'yes' || muleRaw === '1';

        const payableAmount = Math.max(0, amount - otherDeductions);
        
        let id = '';
        if (billType === 'allowance') {
          id = `${year}_${month}_รอบ${period}_allowance_${firstName}_${lastName}`.replace(/\s+/g, '');
        } else {
          id = `${year}_${month}_salary_${firstName}_${lastName}`.replace(/\s+/g, '');
        }

        return {
          id,
          month: month,
          year: year,
          firstName,
          lastName,
          amount,
          isPaid: false,
          paymentType: billType,
          isMuleAccount,
          payableAmount,
          otherDeductions,
          issuedBy: issuerName,
        };
      }).filter(r => r.firstName || r.lastName);

      if (records.length === 0) {
        showToast('ไม่พบข้อมูลชื่อ-สกุลในไฟล์', 'error');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      localStorage.setItem('issuerName', issuerName);
      showToast('สร้างบิลสำเร็จ!', 'success');
      
      setTimeout(() => {
        router.push('/');
      }, 1500);

    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
      setSaving(false);
    }
  };

  const totalAmount = parsedData.reduce((sum, row) => {
    const amountKey = Object.keys(row).find(k => (k.includes('เงิน') || k.includes('ยอด') || k.toLowerCase().includes('amount')) && !k.includes('หัก'));
    return sum + (Number(amountKey ? row[amountKey] : 0) || 0);
  }, 0);
  const totalNet = parsedData.reduce((sum, row) => {
    const amountKey = Object.keys(row).find(k => (k.includes('เงิน') || k.includes('ยอด') || k.toLowerCase().includes('amount')) && !k.includes('หัก'));
    const deductionKey = Object.keys(row).find(k => k.includes('หัก') || k.toLowerCase().includes('deduct'));
    const amt = Number(amountKey ? row[amountKey] : 0) || 0;
    const ded = Number(deductionKey ? row[deductionKey] : 0) || 0;
    return sum + Math.max(0, amt - ded);
  }, 0);

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
            <div className="toast-message">{toast.msg}</div>
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
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', flex: 1, textAlign: 'center' }}>
          นำเข้าไฟล์ Excel
        </div>
        <div style={{ width: '54px' }}></div>
      </header>

      {!file ? (
        <div className="animate-fade-in">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: '24px' }}>
            <FileSpreadsheet size={48} color="var(--primary)" style={{ margin: '0 auto 16px auto', opacity: 0.8 }} />
            <h2 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>อัปโหลดไฟล์บิล</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
              รองรับไฟล์ .xlsx, .xls และ .csv
            </p>
            
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: '16px',
                padding: '40px 20px',
                background: isDragging ? 'rgba(79, 70, 229, 0.05)' : 'var(--background)',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} color={isDragging ? 'var(--primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontWeight: 600, color: isDragging ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {isDragging ? 'วางไฟล์ที่นี่' : 'คลิกหรือลากไฟล์มาวางที่นี่'}
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx,.xls,.csv" 
              style={{ display: 'none' }} 
            />

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <button onClick={downloadTemplate} className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Download size={18} /> โหลดไฟล์ Template ตัวอย่าง
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ paddingBottom: '100px' }}>
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileSpreadsheet size={24} color="var(--success)" />
                <div>
                  <div style={{ fontWeight: 600 }}>{file.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{parsedData.length} รายการ</div>
                </div>
              </div>
              <button 
                onClick={() => { setFile(null); setParsedData([]); }}
                className="btn btn-ghost"
                style={{ padding: '8px', color: 'var(--danger)', background: '#fee2e2' }}
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <div style={{ padding: '16px', background: 'var(--background)', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ประเภทบิล</label>
                  <select 
                    value={billType} 
                    onChange={e => setBillType(e.target.value as any)}
                    className="custom-select custom-select-dark"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                  >
                    <option value="salary">เงินเดือน</option>
                    <option value="allowance">เบี้ยเลี้ยง</option>
                  </select>
                </div>
                
                {billType === 'salary' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>เดือน</label>
                      <select 
                        value={month} 
                        onChange={e => setMonth(Number(e.target.value))}
                        className="custom-select custom-select-dark"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                      >
                        {Array.from({length: 12}).map((_, i) => (
                          <option key={i+1} value={i+1}>เดือน {i+1}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ปี</label>
                      <select 
                        value={year} 
                        onChange={e => setYear(Number(e.target.value))}
                        className="custom-select custom-select-dark"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                      >
                        {[year-1, year, year+1].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>รอบที่</label>
                    <input 
                      type="number" 
                      value={period} 
                      onChange={e => setPeriod(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ชื่อผู้ออกบิล</label>
                <input 
                  type="text" 
                  value={issuerName} 
                  onChange={e => setIssuerName(e.target.value)}
                  placeholder="ระบุชื่อผู้สร้างบิล"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, padding: '12px', background: 'var(--surface-hover)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ยอดตั้งต้นรวม</div>
                <div style={{ fontWeight: 600 }}>฿{totalAmount.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, padding: '12px', background: 'var(--primary-gradient)', color: 'white', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>ยอดจ่ายจริงรวม</div>
                <div style={{ fontWeight: 700 }}>฿{totalNet.toLocaleString()}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {parsedData.map((row, idx) => {
                const firstNameKey = Object.keys(row).find(k => k.includes('ชื่อ') || k.toLowerCase().includes('first') || k.toLowerCase() === 'name');
                const lastNameKey = Object.keys(row).find(k => k.includes('สกุล') || k.toLowerCase().includes('last') || k.toLowerCase().includes('sur'));
                const amountKey = Object.keys(row).find(k => (k.includes('เงิน') || k.includes('ยอด') || k.toLowerCase().includes('amount')) && !k.includes('หัก'));
                const deductionKey = Object.keys(row).find(k => k.includes('หัก') || k.toLowerCase().includes('deduct'));
                const muleKey = Object.keys(row).find(k => k.includes('ม้า') || k.toLowerCase().includes('mule'));

                const firstName = String(firstNameKey ? row[firstNameKey] : '').trim();
                const lastName = String(lastNameKey ? row[lastNameKey] : '').trim();
                const amount = Number(amountKey ? row[amountKey] : 0) || 0;
                const otherDeductions = Number(deductionKey ? row[deductionKey] : 0) || 0;
                
                const muleRaw = String(muleKey ? row[muleKey] : '').trim().toLowerCase();
                const isMuleAccount = muleRaw === 'ใช่' || muleRaw === 'true' || muleRaw === 'y' || muleRaw === 'yes' || muleRaw === '1';

                if (!firstName && !lastName) return null;
                const net = Math.max(0, amount - otherDeductions);

                return (
                  <div key={idx} className="card animate-fade-in" style={{ padding: '20px', marginBottom: 0, borderLeft: isMuleAccount ? '4px solid var(--danger)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {idx + 1}. {firstName} {lastName}
                        {isMuleAccount && <span className="badge badge-danger">บัญชีม้า</span>}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>ยอดตั้งต้น (บาท)</label>
                        <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {amount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>หักอื่นๆ (บาท)</label>
                        <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', fontSize: '1rem', color: 'var(--danger)', fontWeight: 500 }}>
                          {otherDeductions.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--background)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ยอดคงรับ</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: isMuleAccount ? 'var(--danger)' : 'var(--success)' }}>
                        ฿{net.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {parsedData.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <AlertCircle size={24} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                ไม่พบข้อมูล หรือรูปแบบไฟล์ไม่ถูกต้อง
              </div>
            )}
          </div>
          
        </div>
      )}

      {parsedData.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)', padding: '16px 20px', zIndex: 999, display: 'flex', justifyContent: 'center', boxShadow: '0 -4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              จำนวน <strong style={{ color: 'var(--text-primary)' }}>{parsedData.length}</strong> รายการ
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !issuerName.trim()}
              style={{ padding: '12px 24px', fontSize: '1.05rem', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)', minWidth: '200px', display: 'flex', justifyContent: 'center' }}
            >
              {saving ? 'กำลังบันทึก...' : <><Save size={20} style={{ marginRight: '8px' }} /> ยืนยันสร้างบิล</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
