'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Spinner, Input, Select } from '@/components/ui';
import { getStaffActivity, StaffActivity, updateStaff, updateCurrentProfile } from '@/lib/api/staff';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useIsAdmin } from '@/hooks/useAuth';

export default function StaffDetailPage() {
  const params = useParams();
  const router = useRouter();
  const staffId = params.id as string;
  const { user } = useAuthStore();
  const isAdmin = useIsAdmin();
  const isOwnProfile = user?.id === staffId;

  const [activity, setActivity] = useState<StaffActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    preferredName: '',
    phone: '',
    whatsapp: '',
    uaePhone: '',
    fullName: '',
    email: '',
    nyuEmail: '',
    classYear: '',
    major: '',
    minor: '',
    notes: '',
    role: 'staff' as 'staff' | 'admin',
    position: '',
  });

  useEffect(() => {
    if (staffId) {
      fetchActivity();
    }
  }, [staffId]);

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStaffActivity(staffId);
      setActivity(data);
      // Initialize form data
      setFormData({
        preferredName: data.staff.preferredName || '',
        phone: data.staff.phone || '',
        whatsapp: data.staff.whatsapp || '',
        uaePhone: data.staff.uaePhone || '',
        fullName: data.staff.fullName || '',
        email: data.staff.email || '',
        nyuEmail: data.staff.nyuEmail || '',
        classYear: data.staff.classYear || '',
        major: data.staff.major || '',
        minor: data.staff.minor || '',
        notes: data.staff.notes || '',
        role: data.staff.role || 'staff',
        position: data.staff.position || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load staff activity');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isOwnProfile) {
        // Users can edit their own preferred name, contact info, and student info
        await updateCurrentProfile({
          preferredName: formData.preferredName || undefined,
          whatsapp: formData.whatsapp || undefined,
          uaePhone: formData.uaePhone || undefined,
          nyuEmail: formData.nyuEmail || undefined,
          classYear: formData.classYear || undefined,
          major: formData.major || undefined,
          minor: formData.minor || undefined,
          notes: formData.notes || undefined,
        });
      } else if (isAdmin) {
        // Admins can edit all fields
        await updateStaff(staffId, {
          fullName: formData.fullName,
          preferredName: formData.preferredName || undefined,
          email: formData.email,
          nyuEmail: formData.nyuEmail || undefined,
          classYear: formData.classYear || undefined,
          major: formData.major || undefined,
          minor: formData.minor || undefined,
          notes: formData.notes || undefined,
          role: formData.role,
          position: formData.position || undefined,
          whatsapp: formData.whatsapp || undefined,
          uaePhone: formData.uaePhone || undefined,
        });
      }
      setIsEditing(false);
      await fetchActivity(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to current activity data
    if (activity) {
      setFormData({
        preferredName: activity.staff.preferredName || '',
        phone: activity.staff.phone || '',
        whatsapp: activity.staff.whatsapp || '',
        uaePhone: activity.staff.uaePhone || '',
        fullName: activity.staff.fullName || '',
        email: activity.staff.email || '',
        nyuEmail: activity.staff.nyuEmail || '',
        classYear: activity.staff.classYear || '',
        major: activity.staff.major || '',
        minor: activity.staff.minor || '',
        notes: activity.staff.notes || '',
        role: activity.staff.role || 'staff',
        position: activity.staff.position || '',
      });
    }
    setIsEditing(false);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('ATTENDANCE')) return '📋';
    if (action.includes('STRIKE')) return '⚠️';
    if (action.includes('EVENT')) return '📅';
    if (action.includes('STUDENT')) return '👤';
    return '📝';
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <FullScreenLoading />
      </ProtectedRoute>
    );
  }

  if (error || !activity) {
    return (
      <ProtectedRoute>
        <PageLayout title="Staff Details">
          <Card className="p-8 text-center">
            <p className="text-red-600">{error || 'Staff member not found'}</p>
            <Link href="/staff">
              <Button variant="outline" className="mt-4">Back to Staff</Button>
            </Link>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title={activity.staff.preferredName || activity.staff.fullName}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/staff">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Staff
              </Button>
            </Link>
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  variant="primary"
                  size="sm"
                  isLoading={saving}
                  className="flex items-center gap-2"
                  style={{ backgroundColor: '#57068c' }}
                >
                  Save
                </Button>
              </>
            ) : (isOwnProfile || isAdmin) && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="primary"
                size="sm"
                className="flex items-center gap-2"
                style={{ backgroundColor: '#57068c' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-600">
                      {isEditing && isAdmin ? formData.fullName.charAt(0) : activity.staff.fullName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-3">
                        {isAdmin && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                            <Input
                              value={formData.fullName}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, fullName: e.target.value })}
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Name</label>
                          <Input
                            value={formData.preferredName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, preferredName: e.target.value })}
                            placeholder="Enter preferred name"
                          />
                        </div>
                        {isAdmin && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <Input
                              type="email"
                              value={formData.email}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                            />
                          </div>
                        )}
                        {isAdmin && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                            <Select
                              value={formData.role}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, role: e.target.value as 'staff' | 'admin' })}
                              options={[
                                { value: 'staff', label: 'GEO' },
                                { value: 'admin', label: 'Admin' },
                              ]}
                            />
                          </div>
                        )}
                        {isAdmin && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                            <Input
                              value={formData.position}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, position: e.target.value })}
                              placeholder="e.g., GEO"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-bold text-gray-900">
                          {activity.staff.preferredName || activity.staff.fullName}
                        </h2>
                        {activity.staff.preferredName && activity.staff.preferredName !== activity.staff.fullName && (
                          <p className="text-sm text-gray-500">{activity.staff.fullName}</p>
                        )}
                        <p className="text-gray-500">{activity.staff.email}</p>
                        {activity.staff.nyuEmail && activity.staff.nyuEmail !== activity.staff.email && (
                          <p className="text-sm text-gray-500">NYU: {activity.staff.nyuEmail}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant={activity.staff.role === 'admin' ? 'info' : 'default'}>
                            {activity.staff.role.toUpperCase()}
                          </Badge>
                          {activity.staff.position && (
                            <Badge variant="outline">{activity.staff.position}</Badge>
                          )}
                          {activity.staff.classYear && (
                            <Badge variant="outline">Class of {activity.staff.classYear}</Badge>
                          )}
                          {activity.staff.major && (
                            <Badge variant="outline">{activity.staff.major}</Badge>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Contact Information */}
            {(activity.staff.whatsapp || activity.staff.uaePhone || isEditing) && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">UAE Phone</label>
                        <Input
                          value={formData.uaePhone}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, uaePhone: e.target.value })}
                          placeholder="Enter UAE phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp</label>
                        <Input
                          value={formData.whatsapp}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, whatsapp: e.target.value })}
                          placeholder="Enter WhatsApp number"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {activity.staff.uaePhone && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">UAE Phone:</span>
                          <p className="text-gray-900">{activity.staff.uaePhone}</p>
                        </div>
                      )}
                      {activity.staff.whatsapp && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">WhatsApp:</span>
                          <p className="text-gray-900">{activity.staff.whatsapp}</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Academic Information */}
            {(activity.staff.nyuEmail || activity.staff.classYear || activity.staff.major || activity.staff.minor || activity.staff.notes || isEditing) && (
              <Card>
                <CardHeader>
                  <CardTitle>Academic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">NYU Email</label>
                        <Input
                          type="email"
                          value={formData.nyuEmail}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nyuEmail: e.target.value })}
                          placeholder="john.doe@nyu.edu"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Class Year</label>
                        <Input
                          value={formData.classYear}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, classYear: e.target.value })}
                          placeholder="2026"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Major</label>
                        <Input
                          value={formData.major}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, major: e.target.value })}
                          placeholder="Computer Science"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Minor</label>
                        <Input
                          value={formData.minor}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, minor: e.target.value })}
                          placeholder="Economics"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          value={formData.notes}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Additional notes..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {activity.staff.nyuEmail && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">NetID:</span>
                          <p className="text-gray-900">{activity.staff.nyuEmail.split('@')[0]}</p>
                        </div>
                      )}
                      {activity.staff.classYear && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Class Year:</span>
                          <p className="text-gray-900">{activity.staff.classYear}</p>
                        </div>
                      )}
                      {activity.staff.major && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Major(s):</span>
                          <p className="text-gray-900">{activity.staff.major}</p>
                        </div>
                      )}
                      {activity.staff.minor && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Minor(s):</span>
                          <p className="text-gray-900">{activity.staff.minor}</p>
                        </div>
                      )}
                      {activity.staff.notes && (
                        <div>
                          <span className="text-sm font-medium text-gray-600">Notes:</span>
                          <p className="text-gray-900 whitespace-pre-wrap">{activity.staff.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

          </div>

          {/* Right Column - Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Organized Events */}
            <Card>
              <CardHeader>
                <CardTitle>Events Organized</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.organizedEvents.length === 0 ? (
                  <p className="text-gray-500">No events organized yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activity.organizedEvents.map((event: any) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{event.name}</p>
                            <p className="text-sm text-gray-500">{event.location}</p>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(event.startDate)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity - Changes Made by Staff */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activity.recentActivity.length === 0 ? (
                  <p className="text-gray-500">No recent activity.</p>
                ) : (
                  <div className="space-y-3">
                    {activity.recentActivity.map((log: any) => {
                      // Parse details if it's a string
                      let details = log.details;
                      if (typeof log.details === 'string') {
                        try {
                          details = JSON.parse(log.details);
                        } catch {
                          details = log.details;
                        }
                      }

                      // Format the action description
                      const actionText = log.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                      
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <span className="text-2xl flex-shrink-0">{getActionIcon(log.action)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">
                              {actionText}
                            </p>
                            {details && typeof details === 'object' && (
                              <div className="mt-1 space-y-1">
                                {details.studentName && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Student:</span> {details.studentName}
                                  </p>
                                )}
                                {details.eventName && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Event:</span> {details.eventName}
                                  </p>
                                )}
                                {details.fullName && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Staff:</span> {details.fullName}
                                  </p>
                                )}
                                {details.email && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Email:</span> {details.email}
                                  </p>
                                )}
                                {details.role && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Role:</span> {details.role}
                                  </p>
                                )}
                                {details.position && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Position:</span> {details.position}
                                  </p>
                                )}
                                {details.reason && (
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Reason:</span> {details.reason}
                                  </p>
                                )}
                              </div>
                            )}
                            {details && typeof details === 'string' && details.length > 0 && (
                              <p className="text-sm text-gray-600 mt-1">{details}</p>
                            )}
                            {log.targetType && (
                              <p className="text-xs text-gray-500 mt-1">
                                {log.targetType === 'student' && '👤 Student'}
                                {log.targetType === 'event' && '📅 Event'}
                                {log.targetType === 'staff' && '👥 Staff'}
                                {log.targetType === 'attendance' && '📋 Attendance'}
                                {log.targetType === 'strike' && '⚠️ Strike'}
                                {log.targetId && ` • ID: ${log.targetId.substring(0, 8)}...`}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              {formatDateTime(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </PageLayout>
    </ProtectedRoute>
  );
}

