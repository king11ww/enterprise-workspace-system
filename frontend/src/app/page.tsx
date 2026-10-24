'use client';

import React, { useState, useEffect } from 'react';
import { api, setToken, removeToken, getToken } from '@/lib/api';

export default function WorkspaceDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState<'resources' | 'bookings' | 'concurrency'>('resources');

  // Resources state
  const [resources, setResources] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingResources, setLoadingResources] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // AI Prompt Bar state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Booking Modal
  const [bookingModalResource, setBookingModalResource] = useState<any>(null);
  const [modalStartTime, setModalStartTime] = useState('');
  const [modalDurationHours, setModalDurationHours] = useState(1);
  const [modalTitle, setModalTitle] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Concurrency Simulator state
  const [concurrencyRunning, setConcurrencyRunning] = useState(false);
  const [concurrencyResults, setConcurrencyResults] = useState<{ ok: number; conflict: number; total: number; durationMs: number } | null>(null);

  // Toast alert
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoadingUser(true);
    const token = getToken();
    if (!token) {
      // Auto-login as Employee by default for smooth demonstration
      await handleQuickLogin('employee@enterprise.local', 'EmployeePassword123!');
      return;
    }

    const res = await api.auth.me();
    if (res.ok) {
      setCurrentUser(res.data);
    } else {
      removeToken();
      await handleQuickLogin('employee@enterprise.local', 'EmployeePassword123!');
    }
    setLoadingUser(false);
  };

  const handleQuickLogin = async (email: string, pw: string) => {
    setLoadingUser(true);
    const res = await api.auth.login(email, pw);
    if (res.ok) {
      setToken(res.data.tokens.accessToken);
      setCurrentUser(res.data.user);
      showToast('success', `Đăng nhập thành công: ${res.data.user.fullName} (${res.data.user.role})`);
    } else {
      showToast('error', res.error || 'Đăng nhập thất bại');
    }
    setLoadingUser(false);
  };

  const loadResources = async () => {
    setLoadingResources(true);
    const res = await api.resources.list({
      type: selectedType || undefined,
      search: searchQuery || undefined,
      limit: 30,
    });
    if (res.ok) {
      setResources(res.data.data);
    }
    setLoadingResources(false);
  };

  const loadBookings = async () => {
    setLoadingBookings(true);
    const res = await api.bookings.list({ limit: 30 });
    if (res.ok) {
      setBookings(res.data.data);
    }
    setLoadingBookings(false);
  };

  useEffect(() => {
    if (currentUser) {
      loadResources();
      loadBookings();
    }
  }, [currentUser, selectedType]);

  // AI Prompt handler
  const handleAiParse = async (overridePrompt?: string) => {
    const text = overridePrompt || aiPrompt;
    if (!text.trim()) {
      showToast('error', 'Vui lòng nhập nội dung yêu cầu');
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    const res = await api.ai.parseIntent(text);
    if (res.ok && res.data.success) {
      setAiResult(res.data);
      showToast('success', 'Trích xuất ý định đặt chỗ thành công!');
    } else {
      showToast('error', res.error || 'Không thể phân tích yêu cầu');
    }
    setAiLoading(false);
  };

  // Execute booking from AI payload
  const handleConfirmAiBooking = async () => {
    if (!aiResult?.bookingPayload) return;
    setBookingSubmitting(true);
    const res = await api.bookings.create(aiResult.bookingPayload);
    if (res.ok) {
      showToast('success', `Đặt phòng thành công! ID: ${res.data.id.substring(0, 8)}...`);
      setAiResult(null);
      setAiPrompt('');
      loadBookings();
      setActiveTab('bookings');
    } else {
      showToast('error', res.error || 'Đặt phòng thất bại');
    }
    setBookingSubmitting(false);
  };

  // Manual booking submit
  const handleManualBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingModalResource || !modalStartTime) return;

    const start = new Date(modalStartTime);
    const end = new Date(start.getTime() + modalDurationHours * 60 * 60 * 1000);

    setBookingSubmitting(true);
    const res = await api.bookings.create({
      resourceId: bookingModalResource.id,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      title: modalTitle || `Đặt chỗ: ${bookingModalResource.name}`,
    });

    if (res.ok) {
      showToast('success', 'Tạo lịch đặt phòng thành công!');
      setBookingModalResource(null);
      loadBookings();
      setActiveTab('bookings');
    } else {
      showToast('error', res.error || 'Không thể đặt lịch');
    }
    setBookingSubmitting(false);
  };

  // Cancel booking
  const handleCancelBooking = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy lịch đặt này?')) return;
    const res = await api.bookings.cancel(id);
    if (res.ok) {
      showToast('success', 'Đã hủy lịch đặt thành công');
      loadBookings();
    } else {
      showToast('error', res.error || 'Hủy thất bại');
    }
  };

  // Concurrency Stress Test Simulator
  const runConcurrencyTest = async (resourceId: string) => {
    setConcurrencyRunning(true);
    setConcurrencyResults(null);

    const N = 20;
    const future = new Date(Date.now() + 120 * 86400000);
    future.setHours(10, 0, 0, 0);
    const startIso = future.toISOString();
    const endIso = new Date(future.getTime() + 60 * 60000).toISOString();

    const t0 = performance.now();
    const requests = Array.from({ length: N }, (_, i) =>
      api.bookings.create({
        resourceId,
        startTime: startIso,
        endTime: endIso,
        title: `Stress Test Concurrency #${i + 1}`,
      }),
    );

    const responses = await Promise.all(requests);
    const durationMs = Math.round(performance.now() - t0);

    const okCount = responses.filter((r) => r.ok).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    setConcurrencyResults({
      total: N,
      ok: okCount,
      conflict: conflictCount,
      durationMs,
    });
    setConcurrencyRunning(false);
    loadBookings();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Alert */}
      {toast && (
        <div
          id="toast-notification"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            background: toast.type === 'success' ? '#065f46' : toast.type === 'error' ? '#991b1b' : '#1e3a8a',
            color: '#fff',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-glass)',
          background: 'rgba(10, 14, 23, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '14px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Enterprise <span className="text-gradient">Workspace</span>
              </h1>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Asset Management & Concurrency Engine
              </div>
            </div>
          </div>

          {/* User & Role Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-role" id="user-role-badge">
                  {currentUser.role}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{currentUser.fullName}</span>
              </div>
            )}

            {/* Quick Role Switchers */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                id="btn-switch-admin"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                onClick={() => handleQuickLogin('admin@enterprise.local', 'AdminPassword123!')}
              >
                Admin
              </button>
              <button
                id="btn-switch-manager"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                onClick={() => handleQuickLogin('manager@enterprise.local', 'ManagerPassword123!')}
              >
                Manager
              </button>
              <button
                id="btn-switch-employee"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                onClick={() => handleQuickLogin('employee@enterprise.local', 'EmployeePassword123!')}
              >
                Employee
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: '24px', flex: 1 }}>
        {/* AI Natural Language Booking Hero Bar */}
        <section
          className="glass-panel"
          style={{
            padding: '24px',
            marginBottom: '28px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.4) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>✨</span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Trợ lý AI Đặt Phòng Thông Minh</h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                }}
              >
                Gemini 2.5 Flash Powered
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Nhập câu lệnh tự nhiên bằng tiếng Việt hoặc tiếng Anh
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              id="ai-prompt-input"
              className="input-field"
              style={{
                fontSize: '0.95rem',
                padding: '12px 16px',
                background: 'rgba(10, 14, 23, 0.9)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
              }}
              placeholder="Ví dụ: Đặt cho tôi phòng họp A vào lúc 14:00 chiều mai trong 2 tiếng..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiParse()}
            />
            <button
              id="btn-ai-parse"
              className="btn btn-primary"
              style={{ minWidth: '150px' }}
              onClick={() => handleAiParse()}
              disabled={aiLoading}
            >
              {aiLoading ? 'Đang trích xuất...' : 'Phân tích AI ⚡'}
            </button>
          </div>

          {/* Quick sample chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mẫu câu gợi ý:</span>
            {[
              'Đặt cho tôi phòng họp A vào lúc 14:00 chiều mai trong 2 tiếng',
              'Book hot desk 101 tomorrow at 9:00 for 3 hours',
              'Đặt phòng hội đồng vào 10:00 sáng mai',
            ].map((chip, idx) => (
              <button
                key={idx}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '16px' }}
                onClick={() => {
                  setAiPrompt(chip);
                  handleAiParse(chip);
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* AI Extraction Preview Card */}
          {aiResult && (
            <div
              id="ai-result-preview"
              className="animate-fade-in"
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#34d399' }}>✅ Trích xuất thành công:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {aiResult.matchedResource?.name || aiResult.extracted.resourceName}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Thời gian: {new Date(aiResult.extracted.startTime).toLocaleString('vi-VN')} ({aiResult.extracted.durationMinutes} phút) | Vị trí: {aiResult.matchedResource?.location || 'Chưa xác định'}
                </div>
              </div>

              {aiResult.bookingPayload && (
                <button
                  id="btn-confirm-ai-booking"
                  className="btn btn-primary"
                  onClick={handleConfirmAiBooking}
                  disabled={bookingSubmitting}
                >
                  {bookingSubmitting ? 'Đang tạo lịch...' : 'Xác nhận Đặt ngay (Có Redis Lock)'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', marginBottom: '24px' }}>
          <button
            id="tab-btn-resources"
            className="btn"
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'resources' ? '2px solid var(--accent-primary)' : 'none',
              background: activeTab === 'resources' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'resources' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('resources')}
          >
            🏢 Danh mục Tài nguyên
          </button>
          <button
            id="tab-btn-bookings"
            className="btn"
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'bookings' ? '2px solid var(--accent-primary)' : 'none',
              background: activeTab === 'bookings' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'bookings' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onClick={() => {
              setActiveTab('bookings');
              loadBookings();
            }}
          >
            📅 Lịch Đặt chỗ ({bookings.length})
          </button>
          <button
            id="tab-btn-concurrency"
            className="btn"
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: activeTab === 'concurrency' ? '2px solid var(--accent-primary)' : 'none',
              background: activeTab === 'concurrency' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: activeTab === 'concurrency' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('concurrency')}
          >
            ⚡ Trình mô phỏng Race Condition
          </button>
        </div>

        {/* Tab 1: Resources Catalog */}
        {activeTab === 'resources' && (
          <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                id="search-resource-input"
                className="input-field"
                style={{ maxWidth: '320px' }}
                placeholder="Tìm theo tên, vị trí..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadResources()}
              />
              <select
                id="filter-type-select"
                className="input-field"
                style={{ maxWidth: '200px' }}
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">Tất cả phân loại</option>
                <option value="MEETING_ROOM">Phòng họp (Meeting Room)</option>
                <option value="DESK">Bàn làm việc (Desk)</option>
                <option value="DEVICE">Thiết bị (Device)</option>
              </select>
            </div>

            {/* Resource Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {resources.map((r) => (
                <div key={r.id} className="glass-panel-interactive" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span className="badge badge-available">{r.status}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Sức chứa: <strong>{r.capacity}</strong>
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>{r.name}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1, marginBottom: '16px' }}>
                    📍 {r.location || 'Chưa cập nhật'} — {r.description || 'Không có mô tả'}
                  </p>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setBookingModalResource(r);
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(9, 0, 0, 0);
                      setModalStartTime(tomorrow.toISOString().slice(0, 16));
                      setModalTitle(`Cuộc họp tại ${r.name}`);
                    }}
                  >
                    Đặt tài nguyên này
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Bookings List */}
        {activeTab === 'bookings' && (
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Danh sách Lịch Đặt chỗ</h3>
            {bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Chưa có lịch đặt chỗ nào. Hãy thử dùng thanh AI ở trên để đặt phòng đầu tiên!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 8px' }}>Tài nguyên</th>
                      <th style={{ padding: '12px 8px' }}>Thời gian</th>
                      <th style={{ padding: '12px 8px' }}>Tiêu đề</th>
                      <th style={{ padding: '12px 8px' }}>Người đặt</th>
                      <th style={{ padding: '12px 8px' }}>Trạng thái</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{b.resource?.name || 'N/A'}</td>
                        <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(b.startTime).toLocaleString('vi-VN')} <br />
                          đến {new Date(b.endTime).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '12px 8px' }}>{b.title || 'Đặt chỗ'}</td>
                        <td style={{ padding: '12px 8px' }}>{b.user?.fullName}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span className={`badge ${b.status === 'CONFIRMED' ? 'badge-available' : 'badge-cancelled'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {b.status === 'CONFIRMED' && (
                            <button
                              className="btn btn-danger"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                              onClick={() => handleCancelBooking(b.id)}
                            >
                              Hủy
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Concurrency Simulator */}
        {activeTab === 'concurrency' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                ⚡ Kiểm chứng Redis Distributed Lock (Trực quan hóa Concurrency)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '780px' }}>
                Hệ thống sẽ đồng loạt bắn <strong>20 requests</strong> qua API trong cùng 1 millisecond để cố tình đặt trùng 1 phòng vào cùng 1 khung giờ.
                Cơ chế <strong>Redis Mutex Lock</strong> và <strong>PostgreSQL Exclusion Constraint</strong> sẽ đảm bảo duy nhất 1 request thành công (201), còn 19 request còn lại bị từ chối chính xác với 409 Conflict.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
              <button
                id="btn-run-concurrency"
                className="btn btn-primary"
                onClick={() => resources[0] && runConcurrencyTest(resources[0].id)}
                disabled={concurrencyRunning || resources.length === 0}
              >
                {concurrencyRunning ? 'Đang bắn 20 requests...' : 'Bắt đầu kiểm thử Concurrency (20 requests song song) 🚀'}
              </button>
            </div>

            {concurrencyResults && (
              <div
                className="animate-fade-in"
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <h4 style={{ fontWeight: 700, marginBottom: '14px', color: '#818cf8' }}>
                  Kết quả kiểm thử thực tế ({concurrencyResults.durationMs}ms):
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Thành công (201 Created)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>{concurrencyResults.ok}</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Duy nhất 1 giao dịch chiếm được Lock</div>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bị chặn an toàn (409 Conflict)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171' }}>{concurrencyResults.conflict}</div>
                    <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Tránh hoàn toàn Double-booking</div>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tổng số request</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818cf8' }}>{concurrencyResults.total}</div>
                    <div style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>Thời gian: {concurrencyResults.durationMs}ms</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Booking Modal */}
        {bookingModalResource && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                Đặt lịch: {bookingModalResource.name}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                📍 {bookingModalResource.location} | Sức chứa: {bookingModalResource.capacity} người
              </p>

              <form onSubmit={handleManualBookingSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Tiêu đề cuộc họp:
                  </label>
                  <input
                    className="input-field"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="Nhập tiêu đề cuộc họp..."
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Thời gian bắt đầu:
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Thời lượng (giờ):
                  </label>
                  <select
                    className="input-field"
                    value={modalDurationHours}
                    onChange={(e) => setModalDurationHours(Number(e.target.value))}
                  >
                    <option value={0.5}>30 phút</option>
                    <option value={1}>1 tiếng</option>
                    <option value={2}>2 tiếng</option>
                    <option value={3}>3 tiếng</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setBookingModalResource(null)}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={bookingSubmitting}
                  >
                    {bookingSubmitting ? 'Đang xử lý...' : 'Xác nhận Đặt phòng'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-glass)',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          background: 'rgba(10, 14, 23, 0.95)',
        }}
      >
        Enterprise Workspace & Asset Management System © 2026. Microservices & Distributed Lock Architecture.
      </footer>
    </div>
  );
}
