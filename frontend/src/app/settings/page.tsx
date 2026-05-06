'use client';

import { useState, useEffect } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge, Modal, Select, Spinner } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { getPreferences, updatePreferences, NotificationPreferences, generateStudentAlerts } from '@/lib/api/notifications';
import { getCurrentProfile, StaffProfile, createStaff } from '@/lib/api/staff';
import { getCurrentSemester, updateCurrentSemester, getAvailableSemesters } from '@/lib/api/system-settings';
import { deleteAccount } from '@/lib/api/auth';
import { Semester } from '@/types';
import { useAuthStore } from '@/store/auth-store';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';

export default function SettingsPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const setViewingSemester = useViewingSemesterStore((s) => s.setViewingSemester);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [currentSemester, setCurrentSemester] = useState<{ semester: Semester; academicYear: number } | null>(null);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [savingSemester, setSavingSemester] = useState(false);
  const [semesterChoice, setSemesterChoice] = useState<Semester>('Spring');
  const [yearChoice, setYearChoice] = useState<number>(new Date().getFullYear());
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffFormData, setStaffFormData] = useState({
    fullName: '',
    email: '',
    role: 'staff' as 'staff' | 'admin',
    position: 'GEO',
    phone: '',
    whatsapp: '',
    uaePhone: '',
    password: '',
  });
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  /** Prefer API profile role when loaded so this page matches server permissions. */
  const isAdminUser = (profile?.role ?? user?.role) === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileData, prefsData, semesterData, available] = await Promise.all([
        getCurrentProfile().catch(() => null),
        getPreferences().catch(() => ({
          strikeAlerts: true,
          eventReminders: true,
          dailySummary: true,
          attendanceAlerts: true,
        })),
        getCurrentSemester().catch(() => null),
        getAvailableSemesters(),
      ]);
      setProfile(profileData);
      setPreferences(prefsData);
      if (semesterData) {
        setCurrentSemester({ semester: semesterData.semester, academicYear: semesterData.academicYear });
        setSemesterChoice(semesterData.semester);
        setYearChoice(semesterData.academicYear);
      }
      setAvailableSemesters(available);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    setSaving(true);
    try {
      const updated = await updatePreferences({ [key]: !preferences[key] });
      setPreferences(updated);
    } catch (err) {
      console.error('Failed to update preference:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendStudentAlerts = async () => {
    setSendingSummary(true);
    try {
      await generateStudentAlerts();
      alert('Student attention alerts generated for all admins!');
    } catch (err) {
      console.error('Failed to generate student alerts:', err);
    } finally {
      setSendingSummary(false);
    }
  };

  const handleCreateStaff = async () => {
    setCreatingStaff(true);
    try {
      await createStaff(staffFormData);
      setShowCreateStaffModal(false);
      setStaffFormData({ fullName: '', email: '', role: 'staff', position: 'GEO', phone: '', whatsapp: '', uaePhone: '', password: '' });
      alert('Staff member created successfully!');
    } catch (err: any) {
      alert('Failed to create staff: ' + (err.message || 'Unknown error'));
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleUpdateSemester = async () => {
    if (!currentSemester) return;
    setSavingSemester(true);
    try {
      const updated = await updateCurrentSemester(currentSemester.semester, currentSemester.academicYear);
      setCurrentSemester({ semester: updated.semester, academicYear: updated.academicYear });
      setViewingSemester(updated.semesterString);
    } catch (err: any) {
      alert('Failed to update semester: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingSemester(false);
    }
  };

  const handleSetActiveSemesterFromChoice = async () => {
    setSavingSemester(true);
    try {
      const updated = await updateCurrentSemester(semesterChoice, yearChoice);
      setCurrentSemester({ semester: updated.semester, academicYear: updated.academicYear });
      setSemesterChoice(updated.semester);
      setYearChoice(updated.academicYear);
      setViewingSemester(updated.semesterString);
      const list = await getAvailableSemesters();
      setAvailableSemesters(list);
    } catch (err: any) {
      alert('Failed to set semester: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingSemester(false);
    }
  };

  const handleSetDefaultSemester = async (semesterString: string) => {
    const match = semesterString.match(/^(Spring|Fall)\s+(\d{4})$/);
    if (!match) return;
    setSavingSemester(true);
    try {
      const updated = await updateCurrentSemester(match[1] as Semester, parseInt(match[2], 10));
      setCurrentSemester({ semester: updated.semester, academicYear: updated.academicYear });
      setSemesterChoice(updated.semester);
      setYearChoice(updated.academicYear);
      setViewingSemester(updated.semesterString);
    } catch (err: any) {
      alert('Failed to set default semester: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingSemester(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await deleteAccount(deletePassword || undefined);
      clearAuth();
      router.push('/login');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <PageLayout title="Settings">
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout title="Settings">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>👤 Your Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-600">
                    {profile?.fullName?.charAt(0) || user?.fullName?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {profile?.fullName || user?.fullName}
                  </h3>
                  <p className="text-gray-500">{profile?.email || user?.email}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Badge variant={isAdminUser ? 'info' : 'default'}>
                      {(profile?.role || user?.role || 'staff').toUpperCase()}
                    </Badge>
                    {profile?.position ? (
                      <span className="text-sm text-gray-600">
                        Team role: <span className="font-medium text-gray-800">{profile.position}</span>
                      </span>
                    ) : null}
                    {profile?.stats && (
                      <>
                        <span className="text-sm text-gray-500">
                          {profile.stats.eventsOrganized} events organized
                        </span>
                        <span className="text-sm text-gray-500">
                          {profile.stats.attendanceMarked} attendance marked
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>🔔 Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              {preferences && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Strike Alerts</p>
                      <p className="text-sm text-gray-500">Get notified when students receive strikes</p>
                    </div>
                    <button
                      onClick={() => handleTogglePreference('strikeAlerts')}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.strikeAlerts ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.strikeAlerts ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Event Reminders</p>
                      <p className="text-sm text-gray-500">Get reminders about upcoming events</p>
                    </div>
                    <button
                      onClick={() => handleTogglePreference('eventReminders')}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.eventReminders ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.eventReminders ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Daily Summary</p>
                      <p className="text-sm text-gray-500">Receive daily activity summaries</p>
                    </div>
                    <button
                      onClick={() => handleTogglePreference('dailySummary')}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.dailySummary ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.dailySummary ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Attendance Alerts</p>
                      <p className="text-sm text-gray-500">Get alerts for attendance issues</p>
                    </div>
                    <button
                      onClick={() => handleTogglePreference('attendanceAlerts')}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences.attendanceAlerts ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences.attendanceAlerts ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Staff: shortcuts match what GEO accounts can do in the app (no admin-only actions). */}
          {!isAdminUser && (
            <Card>
              <CardHeader>
                <CardTitle>📌 Your access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  As staff you can view students and events, take attendance, browse attendance history, and review
                  the at-risk strikes list. Excusing, reinstating, or deleting strikes, creating events, and full
                  reports are limited to admins.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Students</p>
                      <p className="text-sm text-gray-500">Directory and student records</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/students')}>
                      Go to Students
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Events</p>
                      <p className="text-sm text-gray-500">Calendar and event details</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/events')}>
                      Go to Events
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Attendance</p>
                      <p className="text-sm text-gray-500">Past attendance you have access to</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/attendance/history')}>
                      Attendance history
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Strikes</p>
                      <p className="text-sm text-gray-500">At-risk students (view only; changes need an admin)</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/strikes')}>
                      Go to strikes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Actions */}
          {isAdminUser && (
            <Card>
              <CardHeader>
                <CardTitle>🔧 Admin Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Create event</p>
                      <p className="text-sm text-gray-500">Add a new program or trip (admin only)</p>
                    </div>
                    <Button type="button" variant="primary" onClick={() => router.push('/events/new')}>
                      + Add event
                    </Button>
                  </div>

                  {/* Choose a semester: semester + year choice; semesters are admin-managed */}
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                    <p className="font-medium text-gray-900 mb-1">Choose a semester:</p>
                    {currentSemester && (
                      <p className="text-sm text-gray-600 mb-4">
                        Current default semester: <strong>{currentSemester.semester} {currentSemester.academicYear}</strong>
                      </p>
                    )}
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Semester</label>
                        <Select
                          value={semesterChoice}
                          onChange={(e) => setSemesterChoice(e.target.value as Semester)}
                          options={[
                            { value: 'Spring', label: 'Spring' },
                            { value: 'Fall', label: 'Fall' },
                          ]}
                          className="w-28 rounded-xl border-gray-200/90 bg-white py-2.5 text-sm text-gray-800 shadow-sm transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Year</label>
                        <Select
                          value={String(yearChoice)}
                          onChange={(e) => setYearChoice(parseInt(e.target.value, 10))}
                          options={Array.from({ length: 36 }, (_, i) => {
                            const y = 2000 + i;
                            return { value: String(y), label: String(y) };
                          })}
                          className="w-24 rounded-xl border-gray-200/90 bg-white py-2.5 text-sm text-gray-800 shadow-sm transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <Button
                        variant="primary"
                        onClick={handleSetActiveSemesterFromChoice}
                        isLoading={savingSemester}
                        className="py-2.5 px-4 rounded-xl text-sm font-medium min-h-[42px]"
                      >
                        Set as active semester
                      </Button>
                    </div>
                  </div>

                  {/* Available Semesters — list of semesters added by admin; click to set default */}
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                    <p className="font-medium text-gray-900 mb-2">Available Semesters</p>
                    <p className="text-sm text-gray-500 mb-3">Select a semester to set it as the default.</p>
                    {availableSemesters.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No semesters added yet. Set an active semester above to add one.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSemesters.map((sem) => {
                          const isDefault = currentSemester && currentSemester.semester === sem.split(' ')[0] && currentSemester.academicYear === parseInt(sem.split(' ')[1], 10);
                          return (
                            <button
                              key={sem}
                              type="button"
                              onClick={() => handleSetDefaultSemester(sem)}
                              disabled={savingSemester}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ring-1 transition ${
                                isDefault
                                  ? 'bg-primary-600 text-white ring-primary-600'
                                  : 'bg-white text-gray-700 ring-gray-200/80 hover:bg-primary-50 hover:ring-primary-300'
                              }`}
                            >
                              {sem}
                              {isDefault && <span aria-hidden>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Student attention alerts</p>
                      <p className="text-sm text-gray-500">
                        Notify admins about blocked or at-risk students and missing student info (runs for all admins).
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleSendStudentAlerts}
                      isLoading={sendingSummary}
                    >
                      Generate Alerts
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Add staff member</p>
                      <p className="text-sm text-gray-500">Create a GEO or admin login</p>
                    </div>
                    <Button variant="primary" onClick={() => setShowCreateStaffModal(true)}>
                      + Add staff
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Staff directory</p>
                      <p className="text-sm text-gray-500">View or edit GEO and admin accounts</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/staff')}>
                      Go to staff directory
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Reports</p>
                      <p className="text-sm text-gray-500">Semester overview, attendance exports, and risk summaries</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/reports')}>
                      Go to reports
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Strike management</p>
                      <p className="text-sm text-gray-500">At-risk students; excuse, reinstate, or remove strikes</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push('/strikes')}>
                      Go to strikes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">⚠️ Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <p className="font-medium text-gray-900">Delete Account</p>
                  <p className="text-sm text-gray-500">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteAccountModal(true);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 shrink-0"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account Confirmation Modal */}
          <Modal
            isOpen={showDeleteAccountModal}
            onClose={() => setShowDeleteAccountModal(false)}
            title="Delete Account"
          >
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800 font-medium">
                  This will permanently delete your account, including your profile, notification preferences, and personal agenda items.
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Historical records (attendance, etc.) will be preserved but disassociated from your account.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your password to confirm
                </label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                />
              </div>

              {deleteError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{deleteError}</p>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteAccountModal(false)}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteAccount}
                  isLoading={deletingAccount}
                  size="sm"
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 focus:ring-red-500"
                >
                  Permanently Delete Account
                </Button>
              </div>
            </div>
          </Modal>

          {/* Add Staff Modal */}
          {isAdminUser && (
            <Modal isOpen={showCreateStaffModal} onClose={() => setShowCreateStaffModal(false)} title="Add Staff Member">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <Input
                    value={staffFormData.fullName}
                    onChange={(e) => setStaffFormData({ ...staffFormData, fullName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <Input
                    type="email"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    placeholder="john@nyu.edu"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Role</label>
                  <Select
                    value={staffFormData.role}
                    onChange={(e) => setStaffFormData({ ...staffFormData, role: e.target.value as 'staff' | 'admin' })}
                    options={[
                      { value: 'staff', label: 'Staff' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Position</label>
                  <Input
                    value={staffFormData.position}
                    onChange={(e) => setStaffFormData({ ...staffFormData, position: e.target.value })}
                    placeholder="GEO"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">UAE Phone</label>
                  <Input
                    value={staffFormData.uaePhone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, uaePhone: e.target.value })}
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <Input
                    value={staffFormData.whatsapp}
                    onChange={(e) => setStaffFormData({ ...staffFormData, whatsapp: e.target.value })}
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone (Other)</label>
                  <Input
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password (optional for SSO)</label>
                  <Input
                    type="password"
                    value={staffFormData.password}
                    onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
                  <Button variant="outline" onClick={() => setShowCreateStaffModal(false)} size="sm" className="w-full sm:w-auto">Cancel</Button>
                  <Button variant="primary" onClick={handleCreateStaff} isLoading={creatingStaff} size="sm" className="w-full sm:w-auto">
                    Create Staff
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}

