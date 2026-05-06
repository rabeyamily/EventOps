'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, Badge, Modal, Input, Spinner } from '@/components/ui';
import { getStudentsAtRisk, excuseStrike, reinstateStrike, deleteStrike, StrikeWithDetails, AtRiskStudentsResponse } from '@/lib/api/strikes';
import { Student } from '@/types';
import { useIsAdmin } from '@/hooks/useAuth';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import { formatDate } from '@/lib/utils';

export default function StrikesPage() {
  const isAdmin = useIsAdmin();
  const { viewingSemester } = useViewingSemesterStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // At-risk data
  const [atRiskData, setAtRiskData] = useState<AtRiskStudentsResponse | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<(Student & { strikes?: StrikeWithDetails[] }) | null>(null);

  // Modal states
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [selectedStrike, setSelectedStrike] = useState<StrikeWithDetails | null>(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAtRiskStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudentsAtRisk(viewingSemester || undefined);
      setAtRiskData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch at-risk students');
    } finally {
      setLoading(false);
    }
  }, [viewingSemester]);

  useEffect(() => {
    fetchAtRiskStudents();
  }, [fetchAtRiskStudents]);

  const handleExcuse = async () => {
    if (!selectedStrike) return;

    setActionLoading(true);
    try {
      await excuseStrike(selectedStrike.id, excuseReason);
      setShowExcuseModal(false);
      setSelectedStrike(null);
      setExcuseReason('');
      fetchAtRiskStudents();
    } catch (err: any) {
      console.error('Failed to excuse strike:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReinstate = async (strikeId: string) => {
    setActionLoading(true);
    try {
      await reinstateStrike(strikeId);
      fetchAtRiskStudents();
    } catch (err: any) {
      console.error('Failed to reinstate strike:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (strikeId: string) => {
    if (!confirm('Are you sure you want to permanently delete this strike?')) return;

    setActionLoading(true);
    try {
      await deleteStrike(strikeId);
      fetchAtRiskStudents();
    } catch (err: any) {
      console.error('Failed to delete strike:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const openExcuseModal = (strike: StrikeWithDetails) => {
    setSelectedStrike(strike);
    setExcuseReason('');
    setShowExcuseModal(true);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <PageLayout title="Strike Management">
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout title="Strike Management">
        {error ? (
          <Card className="p-6 sm:p-8 text-center">
            <p className="text-red-600 text-sm sm:text-base">{error}</p>
            <Button onClick={() => fetchAtRiskStudents()} className="mt-4" size="sm">
              Retry
            </Button>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            {atRiskData && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <Card className="p-3 sm:p-4 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{atRiskData.summary.total}</div>
                  <div className="text-xs sm:text-sm text-gray-600">At Risk</div>
                </Card>
                <Card className="p-3 sm:p-4 text-center bg-yellow-50 border-yellow-200">
                  <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{atRiskData.summary.oneStrike}</div>
                  <div className="text-xs sm:text-sm text-yellow-700">1 Strike</div>
                </Card>
                <Card className="p-3 sm:p-4 text-center bg-red-50 border-red-200">
                  <div className="text-2xl sm:text-3xl font-bold text-red-600">{atRiskData.summary.blocked}</div>
                  <div className="text-xs sm:text-sm text-red-700">Blocked</div>
                </Card>
              </div>
            )}

            {/* Student List */}
            <div className="space-y-3 sm:space-y-4">
              {atRiskData?.students.length === 0 ? (
                <Card className="p-6 sm:p-8 text-center text-gray-500">
                  <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">✅</div>
                  <p className="text-sm sm:text-base">No students currently at risk!</p>
                </Card>
              ) : (
                atRiskData?.students.map((student) => (
                  <Card
                    key={student.id}
                    className={`p-3 sm:p-4 ${
                      student.strikeCount >= 2 ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover" />
                          ) : (
                            <span className="text-base sm:text-lg font-bold text-gray-500">{student.fullName.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/students/${student.id}`} className="font-medium text-gray-900 hover:text-primary-600 text-sm sm:text-base truncate block">
                            {student.fullName}
                          </Link>
                          <p className="text-xs sm:text-sm text-gray-600 truncate">{student.nyuEmail}</p>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                            <Badge variant={student.strikeCount >= 2 ? 'danger' : 'warning'} size="sm">
                              {student.strikeCount} Strike{student.strikeCount !== 1 ? 's' : ''}
                            </Badge>
                            {student.strikeCount >= 2 && <Badge variant="danger" size="sm">BLOCKED</Badge>}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                        className="self-end sm:self-start text-xs sm:text-sm"
                      >
                        {selectedStudent?.id === student.id ? 'Hide' : 'Strikes'}
                      </Button>
                    </div>

                    {/* Expanded Strike Details */}
                    {selectedStudent?.id === student.id && student.strikes && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-700 mb-2 sm:mb-3 text-sm sm:text-base">Strike History</h4>
                        <div className="space-y-2">
                          {student.strikes.map((strike) => (
                            <div
                              key={strike.id}
                              className={`p-2 sm:p-3 rounded-lg ${
                                strike.isExcused ? 'bg-gray-100' : 'bg-white border border-red-200'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm sm:text-base truncate">
                                    {strike.event?.name || 'Unknown Event'}
                                    {strike.isExcused && (
                                      <span className="ml-2 text-green-600 text-xs sm:text-sm">(Excused)</span>
                                    )}
                                  </p>
                                  <p className="text-xs sm:text-sm text-gray-500">
                                    {strike.event?.startDate && formatDate(strike.event.startDate)}
                                    {strike.reason && ` • ${strike.reason}`}
                                  </p>
                                  {strike.isExcused && strike.excusedBy && (
                                    <p className="text-xs text-gray-400 mt-1 truncate">
                                      Excused by {strike.excusedBy.fullName}: {strike.excusedReason}
                                    </p>
                                  )}
                                </div>

                                {isAdmin && (
                                  <div className="flex gap-2 self-end sm:self-center flex-shrink-0">
                                    {!strike.isExcused ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openExcuseModal(strike)}
                                        className="text-green-600 text-xs sm:text-sm"
                                      >
                                        Excuse
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReinstate(strike.id)}
                                        disabled={actionLoading}
                                        className="text-orange-600 text-xs sm:text-sm"
                                      >
                                        Reinstate
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(strike.id)}
                                      disabled={actionLoading}
                                      className="text-red-600 text-xs sm:text-sm"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        {/* Excuse Strike Modal */}
        <Modal
          isOpen={showExcuseModal}
          onClose={() => setShowExcuseModal(false)}
          title="Excuse Strike"
        >
          <div className="space-y-4">
            <p className="text-gray-600 text-sm sm:text-base">
              Excuse this strike for <strong>{selectedStrike?.event?.name}</strong>?
              {"The student's strike count will be reduced."}
            </p>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Reason for Excuse
              </label>
              <Input
                value={excuseReason}
                onChange={(e) => setExcuseReason(e.target.value)}
                placeholder="e.g., Medical emergency..."
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setShowExcuseModal(false)} size="sm" className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleExcuse}
                disabled={actionLoading}
                isLoading={actionLoading}
                size="sm"
                className="w-full sm:w-auto"
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
