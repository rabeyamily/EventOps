'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle, StatusBadge, Badge, Spinner, Input, Select, Modal } from '@/components/ui';
import { getStudentById, getStudentAttendanceHistory, getStudentStrikeHistory, uploadStudentPhoto, deleteStudentPhoto, deleteStudent, updateStudent } from '@/lib/api/students';
import { getStudentStrikes, excuseStrike, reinstateStrike, StrikeWithDetails } from '@/lib/api/strikes';
import { Student, Attendance, Strike } from '@/types';
import { useIsAdmin } from '@/hooks/useAuth';
import { formatDate, formatDateTime } from '@/lib/utils';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'strikes'>('info');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [emergencyContact, setEmergencyContact] = useState({ type: '', name: '', phone: '', email: '' });
  const [altEmergencyContact, setAltEmergencyContact] = useState({ type: '', name: '', phone: '', email: '' });
  
  // Strike management state
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedStrike, setSelectedStrike] = useState<StrikeWithDetails | null>(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [strikeActionLoading, setStrikeActionLoading] = useState(false);

  // Parse emergency contact string into structured data
  const parseEmergencyContact = (contactString: string): { type: string; name: string; phone: string; email: string } => {
    const parts = contactString.split(' | ');
    const result = { type: '', name: '', phone: '', email: '' };
    
    parts.forEach(part => {
      if (part.startsWith('[') && part.endsWith(']')) {
        result.type = part.slice(1, -1);
      } else if (part.startsWith('Phone: ')) {
        result.phone = part.replace('Phone: ', '');
      } else if (part.startsWith('Email: ')) {
        result.email = part.replace('Email: ', '');
      } else if (!result.name) {
        result.name = part;
      }
    });
    
    return result;
  };

  const fetchStudentData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const [studentData, attendanceData, strikeData] = await Promise.all([
        getStudentById(studentId),
        getStudentAttendanceHistory(studentId).catch(() => []),
        getStudentStrikeHistory(studentId).catch(() => []),
      ]);

      setStudent(studentData);
      setAttendances(attendanceData as any);
      setStrikes(strikeData as any);
      
      // Initialize form data when student is loaded
      if (studentData) {
        const parsedEmergency = parseEmergencyContact(studentData.emergencyContact || '');
        const parsedAltEmergency = parseEmergencyContact(studentData.altEmergencyContact || '');
        
        setEmergencyContact(parsedEmergency);
        setAltEmergencyContact(parsedAltEmergency);
        
        let normalizedGender = studentData.gender || '';
        if (normalizedGender === 'Man' || normalizedGender.toLowerCase() === 'man') {
          normalizedGender = 'Male';
        } else if (normalizedGender === 'Woman' || normalizedGender.toLowerCase() === 'woman') {
          normalizedGender = 'Female';
        }
        
        setFormData({
          fullName: studentData.fullName || '',
          preferredName: studentData.preferredName || '',
          nyuEmail: studentData.nyuEmail || '',
          nNumber: studentData.nNumber || '',
          campus: studentData.campus || 'NYC',
          uaePhone: studentData.uaePhone || '',
          internationalPhone: studentData.internationalPhone || '',
          school: studentData.school || '',
          major: studentData.major || '',
          academicLevel: studentData.academicLevel || '',
          gpa: studentData.gpa || undefined,
          admitTerm: studentData.admitTerm || '',
          birthdate: studentData.birthdate ? (studentData.birthdate as any).split('T')[0] : '',
          citizenship: studentData.citizenship || '',
          passportCountry: studentData.passportCountry || '',
          gender: normalizedGender,
          address: studentData.address || '',
          cohort: studentData.cohort || '',
          primaryCohort: studentData.primaryCohort || '',
          status: studentData.status || 'clear',
          strikeCount: studentData.strikeCount || 0,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]); // Refetch when studentId changes

  // Refetch when page comes into focus (e.g., after returning from edit page)
  useEffect(() => {
    const handleFocus = () => {
      fetchStudentData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStudentData]);

  const handleEdit = () => {
    setActiveTab('info'); // Ensure we're on the info tab when editing
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    // Reset form data to original student data
    if (student) {
      const parsedEmergency = parseEmergencyContact(student.emergencyContact || '');
      const parsedAltEmergency = parseEmergencyContact(student.altEmergencyContact || '');
      
      setEmergencyContact(parsedEmergency);
      setAltEmergencyContact(parsedAltEmergency);
      
      let normalizedGender = student.gender || '';
      if (normalizedGender === 'Man' || normalizedGender.toLowerCase() === 'man') {
        normalizedGender = 'Male';
      } else if (normalizedGender === 'Woman' || normalizedGender.toLowerCase() === 'woman') {
        normalizedGender = 'Female';
      }
      
      setFormData({
        fullName: student.fullName || '',
        preferredName: student.preferredName || '',
        nyuEmail: student.nyuEmail || '',
        nNumber: student.nNumber || '',
        campus: student.campus || 'NYC',
        uaePhone: student.uaePhone || '',
        internationalPhone: student.internationalPhone || '',
        school: student.school || '',
        major: student.major || '',
        academicLevel: student.academicLevel || '',
        gpa: student.gpa || undefined,
        admitTerm: student.admitTerm || '',
        birthdate: student.birthdate ? (student.birthdate as any).split('T')[0] : '',
        citizenship: student.citizenship || '',
        passportCountry: student.passportCountry || '',
        gender: normalizedGender,
        address: student.address || '',
        cohort: student.cohort || '',
        primaryCohort: student.primaryCohort || '',
        status: student.status || 'clear',
        strikeCount: student.strikeCount || 0,
      });
    }
  };

  const buildEmergencyContactString = (contact: { type: string; name: string; phone: string; email: string }) => {
    const parts: string[] = [];
    if (contact.type) parts.push(`[${contact.type}]`);
    if (contact.name) parts.push(contact.name);
    if (contact.phone) parts.push(`Phone: ${contact.phone}`);
    if (contact.email) parts.push(`Email: ${contact.email}`);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  };

  const handleChange = (field: keyof Student, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!student) return;
    
    setSaving(true);
    setError(null);

    try {
      const emergencyContactStr = buildEmergencyContactString(emergencyContact);
      const altEmergencyContactStr = buildEmergencyContactString(altEmergencyContact);

      const cleanedData = Object.fromEntries(
        Object.entries({
          ...formData,
          emergencyContact: emergencyContactStr,
          altEmergencyContact: altEmergencyContactStr,
        }).map(([key, value]) => [
          key,
          typeof value === 'number' ? value : (value === '' ? undefined : value),
        ])
      );

      await updateStudent(studentId, cleanedData);
      setEditMode(false);
      fetchStudentData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!student) return;
    
    if (!confirm(`Are you sure you want to delete ${student.fullName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingStudent(true);
    setError(null);
    try {
      await deleteStudent(student.id);
      router.push('/students');
    } catch (err: any) {
      setError(err.message || 'Failed to delete student');
      setDeletingStudent(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student) return;

    setUploading(true);
    setError(null);
    try {
      const updatedStudent = await uploadStudentPhoto(student.id, file);
      setStudent(updatedStudent);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!student || !student.photoUrl) return;

    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await deleteStudentPhoto(student.id);
      setStudent({ ...student, photoUrl: undefined });
    } catch (err: any) {
      setError(err.message || 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  const openExcuseModal = (strike: any) => {
    setSelectedStrike(strike);
    setExcuseReason('');
    setShowExcuseModal(true);
  };

  const handleExcuseStrike = async () => {
    if (!selectedStrike) return;

    setStrikeActionLoading(true);
    try {
      await excuseStrike(selectedStrike.id, excuseReason);
      setShowExcuseModal(false);
      setSelectedStrike(null);
      setExcuseReason('');
      fetchStudentData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to excuse strike');
    } finally {
      setStrikeActionLoading(false);
    }
  };

  const handleReinstateStrike = async (strikeId: string) => {
    setStrikeActionLoading(true);
    try {
      await reinstateStrike(strikeId);
      fetchStudentData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to reinstate strike');
    } finally {
      setStrikeActionLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <FullScreenLoading />
      </ProtectedRoute>
    );
  }

  if (error || !student) {
    return (
      <ProtectedRoute>
        <PageLayout title="Student Details">
          <Card>
            <CardContent>
              <p className="text-red-600">{error || 'Student not found'}</p>
              <Link href="/students">
                <button className="mt-4 p-2 hover:opacity-80 transition-opacity">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="#57068c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </Link>
            </CardContent>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title={student.fullName}
        actions={
          <>
            <Link href="/students">
              <button className="p-2 hover:opacity-80 transition-opacity">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="#57068c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </Link>
            {isAdmin && (
              <>
                {editMode ? (
                  <>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={handleCancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" className="text-xs sm:text-sm" onClick={handleSave} isLoading={saving}>
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="primary" size="sm" className="text-xs sm:text-sm" onClick={handleEdit}>
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs sm:text-sm text-red-600 border-red-300 hover:bg-red-50" 
                      onClick={handleDeleteStudent}
                      isLoading={deletingStudent}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </>
            )}
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Left Column - Student Info */}
          <div className="lg:col-span-1">
            <Card className="bg-purple-50 border-purple-100">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:space-x-4">
                  {/* Photo */}
                  <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-full bg-gray-200">
                      {student.photoUrl ? (
                        <img
                          src={
                            student.photoUrl.startsWith('http')
                              ? student.photoUrl
                              : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${student.photoUrl}`
                          }
                          alt={student.fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-gray-400">
                          {student.fullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="absolute bottom-0 right-0 flex space-x-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="photo-upload"
                          disabled={uploading}
                        />
                        <label
                          htmlFor="photo-upload"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-md hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Upload Photo"
                        >
                          {uploading ? (
                            <Spinner size="sm" />
                          ) : (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          )}
                        </label>
                        {student.photoUrl && (
                          <button
                            onClick={handlePhotoDelete}
                            disabled={deleting}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete Photo"
                          >
                            {deleting ? (
                              <Spinner size="sm" />
                            ) : (
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{student.fullName}</h2>
                      <StatusBadge status={student.status} size="md" />
                    </div>
                    {student.preferredName && (
                      <p className="text-sm sm:text-base text-gray-600 mt-1">{student.preferredName}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-1 sm:gap-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-500">Email</label>
                    <p className="text-xs sm:text-sm text-gray-900 truncate">{student.nyuEmail}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-500">Campus</label>
                    <p className="text-xs sm:text-sm text-gray-900">{student.campus}</p>
                  </div>
                  {student.cohort && (
                    <div>
                      <label className="text-xs sm:text-sm font-medium text-gray-500">Cohort</label>
                      <p className="text-xs sm:text-sm text-gray-900">{student.cohort}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-500">Strike Count</label>
                    <p className="text-xs sm:text-sm text-gray-900">{student.strikeCount} / 2</p>
                  </div>
                  {student.uaePhone && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">UAE Phone</label>
                      <p className="text-gray-900">{student.uaePhone}</p>
                    </div>
                  )}
                  {student.internationalPhone && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">International Phone</label>
                      <p className="text-gray-900">{student.internationalPhone}</p>
                    </div>
                  )}
                  {student.emergencyContact && (() => {
                    const contact = parseEmergencyContact(student.emergencyContact);
                    return (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                        <div className="mt-1 space-y-1">
                          {contact.name && (
                            <p className="text-sm text-gray-900 font-medium">{contact.name}</p>
                          )}
                          {contact.type && (
                            <p className="text-xs text-gray-600">{contact.type}</p>
                          )}
                          {contact.phone && (
                            <p className="text-xs text-gray-600">Phone: {contact.phone}</p>
                          )}
                          {contact.email && (
                            <p className="text-xs text-gray-600">Email: {contact.email}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="mb-4 border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => !editMode && setActiveTab('info')}
                  disabled={editMode}
                  className={`border-b-2 py-4 px-1 text-sm font-medium ${
                    activeTab === 'info'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Information
                </button>
                <button
                  onClick={() => !editMode && setActiveTab('attendance')}
                  disabled={editMode}
                  className={`border-b-2 py-4 px-1 text-sm font-medium ${
                    activeTab === 'attendance'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Attendance History ({attendances.length})
                </button>
                <button
                  onClick={() => !editMode && setActiveTab('strikes')}
                  disabled={editMode}
                  className={`border-b-2 py-4 px-1 text-sm font-medium ${
                    activeTab === 'strikes'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Strike History ({strikes.length})
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                        {editMode ? (
                          <Input
                            value={formData.fullName || ''}
                            onChange={(e) => handleChange('fullName', e.target.value)}
                            className="mt-1"
                            required
                          />
                        ) : (
                          <p className="text-gray-900">{student.fullName}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Preferred Name</label>
                        {editMode ? (
                          <Input
                            value={formData.preferredName || ''}
                            onChange={(e) => handleChange('preferredName', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.preferredName || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">NYU Email</label>
                        {editMode ? (
                          <Input
                            type="email"
                            value={formData.nyuEmail || ''}
                            onChange={(e) => handleChange('nyuEmail', e.target.value)}
                            className="mt-1"
                            required
                          />
                        ) : (
                          <p className="text-gray-900">{student.nyuEmail}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">N Number</label>
                        {editMode ? (
                          <Input
                            value={formData.nNumber || ''}
                            onChange={(e) => handleChange('nNumber', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.nNumber || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        {editMode ? (
                          <Select
                            options={[
                              { value: 'clear', label: 'Clear' },
                              { value: 'one_strike', label: '1 Strike' },
                              { value: 'blocked', label: 'Blocked' },
                            ]}
                            value={formData.status || 'clear'}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <div className="mt-1">
                            <StatusBadge status={student.status} size="sm" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Strike Count</label>
                        {editMode ? (
                          <Input
                            type="number"
                            min="0"
                            max="2"
                            step="1"
                            value={formData.strikeCount ?? 0}
                            onChange={(e) => handleChange('strikeCount', e.target.value ? parseInt(e.target.value, 10) : 0)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.strikeCount} / 2</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Academic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Academic Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Campus</label>
                        {editMode ? (
                          <Select
                            options={[
                              { value: 'NYC', label: 'NYC' },
                              { value: 'Shanghai', label: 'Shanghai' },
                            ]}
                            value={formData.campus || 'NYC'}
                            onChange={(e) => handleChange('campus', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.campus}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">School</label>
                        {editMode ? (
                          <Input
                            value={formData.school || ''}
                            onChange={(e) => handleChange('school', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.school || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Major</label>
                        {editMode ? (
                          <Input
                            value={formData.major || ''}
                            onChange={(e) => handleChange('major', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.major || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Academic Level</label>
                        {editMode ? (
                          <Input
                            value={formData.academicLevel || ''}
                            onChange={(e) => handleChange('academicLevel', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.academicLevel || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">GPA</label>
                        {editMode ? (
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max="4"
                            value={formData.gpa || ''}
                            onChange={(e) => handleChange('gpa', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.gpa !== undefined && student.gpa !== null ? Number(student.gpa).toFixed(3) : '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Admit Term</label>
                        {editMode ? (
                          <Input
                            value={formData.admitTerm || ''}
                            onChange={(e) => handleChange('admitTerm', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.admitTerm || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Primary Cohort</label>
                        {editMode ? (
                          <Input
                            value={formData.primaryCohort || ''}
                            onChange={(e) => handleChange('primaryCohort', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.primaryCohort || student.cohort?.split(',')[0] || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">All Cohorts</label>
                        {editMode ? (
                          <Input
                            value={formData.cohort || ''}
                            onChange={(e) => handleChange('cohort', e.target.value)}
                            className="mt-1"
                            placeholder="e.g., Spring 2026, Fall 2025"
                          />
                        ) : (
                          <>
                            {student.cohort ? (
                              <>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {student.cohort.split(',').map((cohort, idx) => (
                                    <Badge key={idx} variant="info" className="text-xs">
                                      {cohort.trim()}
                                    </Badge>
                                  ))}
                                </div>
                                {student.cohort.includes(',') && (
                                  <p className="text-xs text-gray-500 mt-1">Returning student</p>
                                )}
                              </>
                            ) : (
                              <p className="text-gray-900">-</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Birthdate</label>
                        {editMode ? (
                          <Input
                            type="date"
                            value={formData.birthdate || ''}
                            onChange={(e) => handleChange('birthdate', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.birthdate ? formatDate(student.birthdate) : '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Gender</label>
                        {editMode ? (
                          <Select
                            options={[
                              { value: '', label: 'Select...' },
                              { value: 'Male', label: 'Male' },
                              { value: 'Female', label: 'Female' },
                            ]}
                            value={formData.gender || ''}
                            onChange={(e) => handleChange('gender', e.target.value || undefined)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">
                            {student.gender === 'Man' || student.gender?.toLowerCase() === 'man' 
                              ? 'Male' 
                              : student.gender === 'Woman' || student.gender?.toLowerCase() === 'woman'
                              ? 'Female'
                              : student.gender || '-'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Citizenship</label>
                        {editMode ? (
                          <Input
                            value={formData.citizenship || ''}
                            onChange={(e) => handleChange('citizenship', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.citizenship || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Passport Country</label>
                        {editMode ? (
                          <Input
                            value={formData.passportCountry || ''}
                            onChange={(e) => handleChange('passportCountry', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.passportCountry || '-'}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-500">Address</label>
                        {editMode ? (
                          <Input
                            value={formData.address || ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900 whitespace-pre-wrap">{student.address || '-'}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">UAE Phone</label>
                        {editMode ? (
                          <Input
                            value={formData.uaePhone || ''}
                            onChange={(e) => handleChange('uaePhone', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.uaePhone || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">International Phone</label>
                        {editMode ? (
                          <Input
                            value={formData.internationalPhone || ''}
                            onChange={(e) => handleChange('internationalPhone', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-gray-900">{student.internationalPhone || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                        {editMode ? (
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <Input
                              value={emergencyContact.type}
                              onChange={(e) => setEmergencyContact({ ...emergencyContact, type: e.target.value })}
                              placeholder="Relationship Type"
                              className="text-xs"
                            />
                            <Input
                              value={emergencyContact.name}
                              onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
                              placeholder="Name"
                              className="text-xs"
                            />
                            <Input
                              value={emergencyContact.phone}
                              onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })}
                              placeholder="Phone"
                              className="text-xs"
                            />
                            <Input
                              type="email"
                              value={emergencyContact.email}
                              onChange={(e) => setEmergencyContact({ ...emergencyContact, email: e.target.value })}
                              placeholder="Email"
                              className="text-xs"
                            />
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {(() => {
                              const contact = parseEmergencyContact(student.emergencyContact || '');
                              return (
                                <>
                                  {contact.name && (
                                    <p className="text-sm text-gray-900 font-medium">{contact.name}</p>
                                  )}
                                  {contact.type && (
                                    <p className="text-xs text-gray-600">{contact.type}</p>
                                  )}
                                  {contact.phone && (
                                    <p className="text-xs text-gray-600">Phone: {contact.phone}</p>
                                  )}
                                  {contact.email && (
                                    <p className="text-xs text-gray-600">Email: {contact.email}</p>
                                  )}
                                  {!contact.name && !contact.type && !contact.phone && !contact.email && (
                                    <p className="text-gray-900">-</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Alt Emergency Contact</label>
                        {editMode ? (
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <Input
                              value={altEmergencyContact.type}
                              onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, type: e.target.value })}
                              placeholder="Relationship Type"
                              className="text-xs"
                            />
                            <Input
                              value={altEmergencyContact.name}
                              onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, name: e.target.value })}
                              placeholder="Name"
                              className="text-xs"
                            />
                            <Input
                              value={altEmergencyContact.phone}
                              onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, phone: e.target.value })}
                              placeholder="Phone"
                              className="text-xs"
                            />
                            <Input
                              type="email"
                              value={altEmergencyContact.email}
                              onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, email: e.target.value })}
                              placeholder="Email"
                              className="text-xs"
                            />
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {(() => {
                              const contact = parseEmergencyContact(student.altEmergencyContact || '');
                              return (
                                <>
                                  {contact.name && (
                                    <p className="text-sm text-gray-900 font-medium">{contact.name}</p>
                                  )}
                                  {contact.type && (
                                    <p className="text-xs text-gray-600">{contact.type}</p>
                                  )}
                                  {contact.phone && (
                                    <p className="text-xs text-gray-600">Phone: {contact.phone}</p>
                                  )}
                                  {contact.email && (
                                    <p className="text-xs text-gray-600">Email: {contact.email}</p>
                                  )}
                                  {!contact.name && !contact.type && !contact.phone && !contact.email && (
                                    <p className="text-gray-900">-</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* System Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Created</label>
                        <p className="text-gray-900">
                          {formatDate(student.createdAt)}
                          {student.createdBy && (
                            <span className="text-gray-600 ml-2">by {student.createdBy.fullName}</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last Updated</label>
                        <p className="text-gray-900">
                          {formatDate(student.updatedAt)}
                          {student.updatedBy && (
                            <span className="text-gray-600 ml-2">by {student.updatedBy.fullName}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'attendance' && (
              <Card>
                <CardHeader>
                  <CardTitle>Attendance History</CardTitle>
                </CardHeader>
                <CardContent>
                  {attendances.length === 0 ? (
                    <p className="text-gray-500">No attendance records found.</p>
                  ) : (
                    <div className="space-y-4">
                      {attendances.map((attendance: any) => (
                        <div
                          key={attendance.id}
                          className="border-b border-gray-200 pb-4 last:border-0"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {attendance.event?.id ? (
                                  <Link
                                    href={`/events/${attendance.event.id}`}
                                    className="font-medium text-gray-900 hover:text-[#57068c] transition-colors"
                                  >
                                    {attendance.event.name || 'Unknown Event'}
                                  </Link>
                                ) : (
                                  <p className="font-medium text-gray-900">
                                    {attendance.event?.name || 'Unknown Event'}
                                  </p>
                                )}
                                {attendance.event?.id && (
                                  <Link
                                    href={`/events/${attendance.event.id}/attendance`}
                                    className="text-xs text-[#57068c] hover:underline"
                                  >
                                    (View Attendance)
                                  </Link>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mb-2">
                                {attendance.event?.startDate
                                  ? formatDate(attendance.event.startDate)
                                  : 'Date unknown'}
                                {attendance.event?.location && ` • ${attendance.event.location}`}
                              </p>
                              {attendance.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded-md border-l-2 border-[#57068c]">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Notes:</p>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{attendance.notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <Badge
                                variant={
                                  attendance.status === 'present'
                                    ? 'success'
                                    : attendance.status === 'absent'
                                    ? 'danger'
                                    : 'default'
                                }
                              >
                                {attendance.status === 'present'
                                  ? 'Present'
                                  : attendance.status === 'absent'
                                  ? 'Absent'
                                  : 'Not Marked'}
                              </Badge>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatDateTime(attendance.markedAt)}
                              </p>
                              {attendance.markedBy && (
                                <p className="text-xs text-gray-500">
                                  by {attendance.markedBy.fullName}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'strikes' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Strike History</CardTitle>
                    {student.strikeCount > 0 && (
                      <Badge variant={student.strikeCount >= 2 ? 'danger' : 'warning'}>
                        {student.strikeCount} Active Strike{student.strikeCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {strikes.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">✅</div>
                      <p className="text-gray-500">No strikes recorded.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {strikes.map((strike: any) => (
                        <div
                          key={strike.id}
                          className={`rounded-lg border p-4 ${
                            strike.isExcused ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Badge variant={strike.isExcused ? 'success' : 'danger'}>
                                  {strike.isExcused ? 'Excused' : 'Active'}
                                </Badge>
                                {strike.event && (
                                  <Link href={`/events/${strike.eventId}`} className="text-sm text-gray-600 hover:text-primary-600">
                                    {strike.event.name}
                                  </Link>
                                )}
                              </div>
                              {strike.reason && (
                                <p className="mt-2 text-sm text-gray-700">
                                  <strong>Reason:</strong> {strike.reason}
                                </p>
                              )}
                              {strike.isExcused && strike.excusedReason && (
                                <p className="mt-1 text-sm text-green-700">
                                  <strong>Excused:</strong> {strike.excusedReason}
                                </p>
                              )}
                              <p className="mt-2 text-xs text-gray-500">
                                Created: {formatDateTime(strike.createdAt)}
                              </p>
                              {strike.excusedBy && (
                                <p className="text-xs text-gray-500">
                                  Excused by {strike.excusedBy.fullName} on {formatDate(strike.excusedAt)}
                                </p>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-2">
                                {!strike.isExcused ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openExcuseModal(strike)}
                                    disabled={strikeActionLoading}
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                  >
                                    Excuse
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReinstateStrike(strike.id)}
                                    disabled={strikeActionLoading}
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                  >
                                    Reinstate
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Excuse Strike Modal */}
        <Modal
          isOpen={showExcuseModal}
          onClose={() => setShowExcuseModal(false)}
          title="Excuse Strike"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Excuse this strike for <strong>{selectedStrike?.event?.name || 'this event'}</strong>?
              {"The student's strike count will be reduced."}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Excuse
              </label>
              <Input
                value={excuseReason}
                onChange={(e) => setExcuseReason(e.target.value)}
                placeholder="e.g., Medical emergency, Family emergency, Prior approval, etc."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowExcuseModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExcuseStrike}
                disabled={strikeActionLoading}
                isLoading={strikeActionLoading}
              >
                Excuse Strike
              </Button>
            </div>
          </div>
        </Modal>
      </PageLayout>
    </ProtectedRoute>
  );
}

