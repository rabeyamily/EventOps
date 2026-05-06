'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Spinner } from '@/components/ui';
import { getStudentById, updateStudent } from '@/lib/api/students';
import { Student } from '@/types';

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Student>>({});
  
  // Emergency contact fields (parsed)
  const [emergencyContact, setEmergencyContact] = useState({
    type: '',
    name: '',
    phone: '',
    email: '',
  });
  
  const [altEmergencyContact, setAltEmergencyContact] = useState({
    type: '',
    name: '',
    phone: '',
    email: '',
  });

  // Parse emergency contact string
  const parseEmergencyContact = (contactString: string) => {
    if (!contactString) return { type: '', name: '', phone: '', email: '' };
    
    const parts = contactString.split(' | ');
    const result: { type?: string; name?: string; phone?: string; email?: string } = {};
    
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
    
    return {
      type: result.type || '',
      name: result.name || '',
      phone: result.phone || '',
      email: result.email || '',
    };
  };

  // Build emergency contact string from fields
  const buildEmergencyContactString = (contact: { type: string; name: string; phone: string; email: string }) => {
    const parts: string[] = [];
    if (contact.type) parts.push(`[${contact.type}]`);
    if (contact.name) parts.push(contact.name);
    if (contact.phone) parts.push(`Phone: ${contact.phone}`);
    if (contact.email) parts.push(`Email: ${contact.email}`);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  };

  useEffect(() => {
    if (studentId) {
      fetchStudent();
    }
  }, [studentId]);

  const fetchStudent = async () => {
    setLoading(true);
    setError(null);
    try {
      const studentData = await getStudentById(studentId);
      setStudent(studentData);
      // Normalize gender values: "Man" -> "Male", "Woman" -> "Female"
      let normalizedGender = studentData.gender || '';
      if (normalizedGender === 'Man' || normalizedGender.toLowerCase() === 'man') {
        normalizedGender = 'Male';
      } else if (normalizedGender === 'Woman' || normalizedGender.toLowerCase() === 'woman') {
        normalizedGender = 'Female';
      }

      // Parse emergency contacts
      const parsedEmergency = parseEmergencyContact(studentData.emergencyContact || '');
      const parsedAltEmergency = parseEmergencyContact(studentData.altEmergencyContact || '');

      setEmergencyContact(parsedEmergency);
      setAltEmergencyContact(parsedAltEmergency);

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
        birthdate: studentData.birthdate ? studentData.birthdate.split('T')[0] : '',
        citizenship: studentData.citizenship || '',
        passportCountry: studentData.passportCountry || '',
        gender: normalizedGender,
        address: studentData.address || '',
        cohort: studentData.cohort || '',
        primaryCohort: studentData.primaryCohort || '',
        status: studentData.status || 'clear',
        strikeCount: studentData.strikeCount || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Student, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Build emergency contact strings
      const emergencyContactStr = buildEmergencyContactString(emergencyContact);
      const altEmergencyContactStr = buildEmergencyContactString(altEmergencyContact);

      // Convert empty strings to undefined, but preserve numbers (including 0)
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
      // Navigate back and the focus event will trigger a refetch
      router.push(`/students/${studentId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <FullScreenLoading />
      </ProtectedRoute>
    );
  }

  if (error && !student) {
    return (
      <ProtectedRoute>
        <PageLayout title="Edit Student">
          <Card>
            <CardContent>
              <p className="text-red-600">{error}</p>
              <button className="mt-4 p-2 hover:opacity-80 transition-opacity" onClick={() => router.push('/students')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="#57068c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </CardContent>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title="Edit Student"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/students/${studentId}`)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={saving}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <Input
                      value={formData.fullName || ''}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Name
                    </label>
                    <Input
                      value={formData.preferredName || ''}
                      onChange={(e) => handleChange('preferredName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NYU Email *
                    </label>
                    <Input
                      type="email"
                      value={formData.nyuEmail || ''}
                      onChange={(e) => handleChange('nyuEmail', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      N Number
                    </label>
                    <Input
                      value={formData.nNumber || ''}
                      onChange={(e) => handleChange('nNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campus *
                    </label>
                    <Select
                      options={[
                        { value: 'NYC', label: 'NYC' },
                        { value: 'Shanghai', label: 'Shanghai' },
                      ]}
                      value={formData.campus || 'NYC'}
                      onChange={(e) => handleChange('campus', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <Select
                      options={[
                        { value: 'clear', label: 'Clear' },
                        { value: 'one_strike', label: '1 Strike' },
                        { value: 'blocked', label: 'Blocked' },
                      ]}
                      value={formData.status || 'clear'}
                      onChange={(e) => handleChange('status', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Strike Count (0-2)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="1"
                      value={formData.strikeCount ?? 0}
                      onChange={(e) => handleChange('strikeCount', e.target.value ? parseInt(e.target.value, 10) : 0)}
                    />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School
                    </label>
                    <Input
                      value={formData.school || ''}
                      onChange={(e) => handleChange('school', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Major
                    </label>
                    <Input
                      value={formData.major || ''}
                      onChange={(e) => handleChange('major', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Academic Level
                    </label>
                    <Input
                      value={formData.academicLevel || ''}
                      onChange={(e) => handleChange('academicLevel', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GPA
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      max="4"
                      value={formData.gpa || ''}
                      onChange={(e) => handleChange('gpa', e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admit Term
                    </label>
                    <Input
                      value={formData.admitTerm || ''}
                      onChange={(e) => handleChange('admitTerm', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Cohort
                    </label>
                    <Input
                      value={formData.primaryCohort || ''}
                      onChange={(e) => handleChange('primaryCohort', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      All Cohorts (comma-separated)
                    </label>
                    <Input
                      value={formData.cohort || ''}
                      onChange={(e) => handleChange('cohort', e.target.value)}
                      placeholder="e.g., Spring 2026, Fall 2025"
                    />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Birthdate
                    </label>
                    <Input
                      type="date"
                      value={formData.birthdate || ''}
                      onChange={(e) => handleChange('birthdate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <Select
                      options={[
                        { value: '', label: 'Select...' },
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                      ]}
                      value={formData.gender === 'Man' || formData.gender === 'man' ? 'Male' : (formData.gender === 'Woman' || formData.gender === 'woman' ? 'Female' : (formData.gender || ''))}
                      onChange={(e) => handleChange('gender', e.target.value || undefined)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Citizenship
                    </label>
                    <Input
                      value={formData.citizenship || ''}
                      onChange={(e) => handleChange('citizenship', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Country
                    </label>
                    <Input
                      value={formData.passportCountry || ''}
                      onChange={(e) => handleChange('passportCountry', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <Input
                      value={formData.address || ''}
                      onChange={(e) => handleChange('address', e.target.value)}
                    />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UAE Phone
                    </label>
                    <Input
                      value={formData.uaePhone || ''}
                      onChange={(e) => handleChange('uaePhone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      International Phone
                    </label>
                    <Input
                      value={formData.internationalPhone || ''}
                      onChange={(e) => handleChange('internationalPhone', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Emergency Contact
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Relationship Type
                        </label>
                        <Input
                          value={emergencyContact.type}
                          onChange={(e) => setEmergencyContact({ ...emergencyContact, type: e.target.value })}
                          placeholder="e.g., Parent / Legal Guardian"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name
                        </label>
                        <Input
                          value={emergencyContact.name}
                          onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
                          placeholder="Contact name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Phone
                        </label>
                        <Input
                          value={emergencyContact.phone}
                          onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Email
                        </label>
                        <Input
                          type="email"
                          value={emergencyContact.email}
                          onChange={(e) => setEmergencyContact({ ...emergencyContact, email: e.target.value })}
                          placeholder="Email address"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Alt Emergency Contact
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Relationship Type
                        </label>
                        <Input
                          value={altEmergencyContact.type}
                          onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, type: e.target.value })}
                          placeholder="e.g., Parent / Legal Guardian"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Name
                        </label>
                        <Input
                          value={altEmergencyContact.name}
                          onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, name: e.target.value })}
                          placeholder="Contact name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Phone
                        </label>
                        <Input
                          value={altEmergencyContact.phone}
                          onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, phone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Email
                        </label>
                        <Input
                          type="email"
                          value={altEmergencyContact.email}
                          onChange={(e) => setAltEmergencyContact({ ...altEmergencyContact, email: e.target.value })}
                          placeholder="Email address"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push(`/students/${studentId}`)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </PageLayout>
    </ProtectedRoute>
  );
}
