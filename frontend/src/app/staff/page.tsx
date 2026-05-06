'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, Badge, Modal, Input, Select, Spinner } from '@/components/ui';
import { getAllStaff, createStaff, updateStaff, deleteStaff, StaffFilters } from '@/lib/api/staff';
import { Staff, PaginatedResponse } from '@/types';
import { useIsAdmin } from '@/hooks/useAuth';
import ListPageCsvImportButton from '@/components/admin/ListPageCsvImportButton';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/utils';

export default function StaffPage() {
  const isAdmin = useIsAdmin();
  const searchParams = useSearchParams();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const roleParam = searchParams?.get('role');
  const roleFilter: 'staff' | 'admin' | '' = roleParam === 'staff' || roleParam === 'admin' ? roleParam : '';
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    preferredName: '',
    email: '',
    nyuEmail: '',
    classYear: '',
    major: '',
    role: 'staff' as 'staff' | 'admin',
    position: 'GEO',
    phone: '',
    whatsapp: '',
    uaePhone: '',
    password: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const directoryTitle =
    roleFilter === 'admin'
      ? 'Admin Directory'
      : roleFilter === 'staff'
      ? 'GEO Directory'
      : 'Staff Directory';
  const createButtonLabel =
    roleFilter === 'admin'
      ? 'Add Admin'
      : roleFilter === 'staff'
      ? 'Add GEO'
      : 'Add Staff';
  const visibleStaff = roleFilter ? staff.filter((member) => member.role === roleFilter) : staff;

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: StaffFilters = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        role: roleFilter as 'staff' | 'admin' || undefined,
      };

      const response = await getAllStaff(filters);
      const serverData = response.data || [];
      const strictRoleData = roleFilter
        ? serverData.filter((member) => member.role === roleFilter)
        : serverData;

      setStaff(strictRoleData);
      setPagination(response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, roleFilter]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [roleFilter]);

  useEffect(() => {
    // Allow all staff to view the GEO directory
    fetchStaff();
  }, [fetchStaff]);

  const handleCreate = async () => {
    setActionLoading(true);
    try {
      await createStaff(formData);
      setShowCreateModal(false);
      setFormData({ fullName: '', preferredName: '', email: '', nyuEmail: '', classYear: '', major: '', role: 'staff', position: 'GEO', phone: '', whatsapp: '', uaePhone: '', password: '' });
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedStaff) return;
    setActionLoading(true);
    try {
      await updateStaff(selectedStaff.id, {
        fullName: formData.fullName,
        preferredName: formData.preferredName,
        email: formData.email,
        nyuEmail: formData.nyuEmail,
        classYear: formData.classYear,
        major: formData.major,
        role: formData.role,
        position: formData.position,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        uaePhone: formData.uaePhone,
      });
      setShowEditModal(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (staffMember: Staff) => {
    setStaffToDelete(staffMember);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!staffToDelete) return;
    setActionLoading(true);
    try {
      await deleteStaff(staffToDelete.id);
      setShowDeleteModal(false);
      setStaffToDelete(null);
      fetchStaff();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setStaffToDelete(null);
  };

  const openEditModal = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setFormData({
      fullName: staffMember.fullName,
      preferredName: staffMember.preferredName || '',
      email: staffMember.email,
      nyuEmail: staffMember.nyuEmail || '',
      classYear: staffMember.classYear || '',
      major: staffMember.major || '',
      role: staffMember.role as 'staff' | 'admin',
      position: staffMember.position || 'GEO',
      phone: staffMember.phone || '',
      whatsapp: staffMember.whatsapp || '',
      uaePhone: staffMember.uaePhone || '',
      password: '',
    });
    setShowEditModal(true);
  };

  // All staff can view, but only admins can manage

  if (loading) {
    return (
      <ProtectedRoute>
        <PageLayout title={directoryTitle}>
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title={directoryTitle}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <ListPageCsvImportButton href="/staff/import" />
              <Button
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    role: roleFilter === 'admin' ? 'admin' : 'staff',
                  }));
                  setShowCreateModal(true);
                }}
                variant="primary"
                size="sm"
                className="text-xs sm:text-sm"
              >
                {createButtonLabel}
              </Button>
            </div>
          ) : null
        }
      >
        {/* Staff List */}
        {error ? (
          <Card className="p-6 sm:p-8 text-center">
            <p className="text-red-600 text-sm sm:text-base">{error}</p>
            <Button onClick={fetchStaff} className="mt-4" size="sm">Retry</Button>
          </Card>
        ) : visibleStaff.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
            No staff members found.
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {visibleStaff.map((member) => (
              <Card key={member.id} className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Link
                      href={`/staff/${member.id}`}
                      aria-label={`Open profile for ${member.fullName}`}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 hover:bg-primary-200 transition-colors"
                    >
                      <span className="text-base sm:text-lg font-bold text-primary-600">
                        {member.fullName.charAt(0)}
                      </span>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/staff/${member.id}`} className="font-medium text-gray-900 hover:text-primary-600 text-sm sm:text-base truncate block">
                        {member.fullName}
                      </Link>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{member.email}</p>
                      {member.nyuEmail && (
                        <p className="text-xs text-gray-500 truncate">{member.nyuEmail}</p>
                      )}
                      {(member.classYear || member.major) && (
                        <p className="text-[11px] text-gray-500 truncate">
                          {member.classYear && `Class of ${member.classYear}`}{member.classYear && member.major ? ' • ' : ''}{member.major}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant={member.role === 'admin' ? 'info' : 'default'} size="sm">
                          {member.position || 'GEO'}
                        </Badge>
                        {member.role === 'admin' && (
                          <Badge variant="info" size="sm">Admin</Badge>
                        )}
                      </div>
                      {(member.uaePhone || member.whatsapp) && (
                        <div className="mt-2 space-y-0.5">
                          {member.uaePhone && (
                            <p className="text-xs text-gray-600">
                              📞 UAE: <a href={`tel:${member.uaePhone}`} className="text-primary-600 hover:underline">{member.uaePhone}</a>
                            </p>
                          )}
                          {member.whatsapp && (
                            <p className="text-xs text-gray-600">
                              💬 WhatsApp: <a href={`https://wa.me/${member.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{member.whatsapp}</a>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => openEditModal(member)} 
                        className="text-gray-600 hover:text-primary-600 p-1 sm:p-2"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDeleteClick(member)} 
                        className="text-gray-600 hover:text-red-600 p-1 sm:p-2"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mt-4 sm:mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="text-xs sm:text-sm"
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-600 text-xs sm:text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="text-xs sm:text-sm"
            >
              Next
            </Button>
          </div>
        )}

        {/* Create Modal */}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Staff Member">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@nyu.edu"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">NYU Email</label>
              <Input
                type="email"
                value={formData.nyuEmail}
                onChange={(e) => setFormData({ ...formData, nyuEmail: e.target.value })}
                placeholder="john.doe@nyu.edu"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class Year</label>
              <Input
                value={formData.classYear}
                onChange={(e) => setFormData({ ...formData, classYear: e.target.value })}
                placeholder="2026"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Major</label>
              <Input
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                placeholder="Computer Science"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Role</label>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'staff' | 'admin' })}
                options={[
                  { value: 'staff', label: 'Staff' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Position</label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="GEO"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">UAE Phone</label>
              <Input
                value={formData.uaePhone}
                onChange={(e) => setFormData({ ...formData, uaePhone: e.target.value })}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone (Other)</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password (optional for SSO)</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} size="sm" className="w-full sm:w-auto">Cancel</Button>
              <Button variant="primary" onClick={handleCreate} isLoading={actionLoading} size="sm" className="w-full sm:w-auto">
                Create Staff
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Staff Member">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">NYU Email</label>
              <Input
                type="email"
                value={formData.nyuEmail}
                onChange={(e) => setFormData({ ...formData, nyuEmail: e.target.value })}
                placeholder="john.doe@nyu.edu"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Class Year</label>
              <Input
                value={formData.classYear}
                onChange={(e) => setFormData({ ...formData, classYear: e.target.value })}
                placeholder="2026"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Major</label>
              <Input
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                placeholder="Computer Science"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Role</label>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'staff' | 'admin' })}
                options={[
                  { value: 'staff', label: 'Staff' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Position</label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="GEO"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">UAE Phone</label>
              <Input
                value={formData.uaePhone}
                onChange={(e) => setFormData({ ...formData, uaePhone: e.target.value })}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone (Other)</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
              <Button variant="outline" onClick={() => setShowEditModal(false)} size="sm" className="w-full sm:w-auto">Cancel</Button>
              <Button variant="primary" onClick={handleUpdate} isLoading={actionLoading} size="sm" className="w-full sm:w-auto">
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={handleDeleteCancel}
          title="Delete Staff Member"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{staffToDelete?.fullName}</strong>?
            </p>
            {staffToDelete?.email && (
              <p className="text-sm text-gray-500">
                Email: {staffToDelete.email}
              </p>
            )}
            <p className="text-sm text-red-600 font-medium">
              This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2 sm:pt-4">
              <Button
                variant="outline"
                onClick={handleDeleteCancel}
                disabled={actionLoading}
                size="sm"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                isLoading={actionLoading}
                size="sm"
                className="w-full sm:w-auto"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </PageLayout>
    </ProtectedRoute>
  );
}
