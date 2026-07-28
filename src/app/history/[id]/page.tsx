'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PaymentRecord } from '@/types';

export default function HistoryPage() {
  const { id } = useParams();
  const router = useRouter();
  const decodedName = decodeURIComponent(id as string);
  
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/payments');
        const data = await res.json();
        if (data.records) {
          const userRecords = data.records.filter((r: PaymentRecord) => `${r.firstName} ${r.lastName}`.trim() === decodedName.trim());
          setRecords(userRecords);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [decodedName]);

  const chartData: any[] = [];
  const monthMap = new Map();

  records.forEach(r => {
    const key = `${r.month}/${r.year}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { name: key, salary: 0, allowance: 0, sortKey: r.year * 100 + r.month });
    }
    const entry = monthMap.get(key);
    const effectiveAmount = r.payableAmount !== undefined ? r.payableAmount : r.amount;
    if (r.paymentType === 'allowance') {
      entry.allowance += effectiveAmount;
    } else {
      entry.salary += effectiveAmount;
    }
  });

  chartData.push(...Array.from(monthMap.values()).sort((a, b) => a.sortKey - b.sortKey));

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <button 
        className="btn btn-ghost" 
        onClick={() => router.back()}
        style={{ marginBottom: '20px', padding: '8px 16px', background: 'var(--surface)' }}
      >
        <ChevronLeft size={18} /> กลับ
      </button>

      <div className="card" style={{ marginBottom: '20px', background: 'var(--primary-gradient)', color: 'white' }}>
        <div style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.9 }}>ประวัติการรับเงิน</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, margin: '4px 0' }}>{decodedName}</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>กำลังโหลดข้อมูล...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ไม่พบประวัติการรับเงิน</div>
      ) : (
        <div className="animate-fade-in">
          <div className="card" style={{ padding: '20px', height: '300px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>สรุปยอดรายเดือน</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} dx={-10} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="salary" name="เงินเดือน" stackId="a" fill="var(--primary)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="allowance" name="เบี้ยเลี้ยง" stackId="a" fill="var(--success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '24px', marginBottom: '12px', paddingLeft: '8px' }}>รายการทั้งหมด</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.sort((a,b) => (b.year*100+b.month) - (a.year*100+a.month)).map(r => (
              <div key={r.id} className="card flex-between" style={{ padding: '16px 20px', marginBottom: 0, borderLeft: `4px solid ${r.paymentType === 'allowance' ? 'var(--success)' : 'var(--primary)'}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{r.month}/{r.year}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {r.paymentType === 'allowance' ? 'เบี้ยเลี้ยง' : 'เงินเดือน'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>฿{(r.payableAmount !== undefined ? r.payableAmount : r.amount).toLocaleString()}</div>
                  {r.otherDeductions ? <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>หักอื่นๆ: ฿{r.otherDeductions.toLocaleString()}</div> : null}
                  <div style={{ fontSize: '0.8rem', color: r.isPaid ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {r.isPaid ? '✓ จ่ายแล้ว' : 'รอจ่าย'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
