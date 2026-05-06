'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Spinner } from '@/components/ui';
import { createEvent } from '@/lib/api/events';
import { getAllStaff } from '@/lib/api/staff';
import { useIsAdmin } from '@/hooks/useAuth';
import { isEligibleGeoLeadOrganizer } from '@/lib/eligible-geo-lead';
import type { Staff } from '@/types';

export default function NewEventPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoLeads, setGeoLeads] = useState<Staff[]>([]);
  const [lead1, setLead1] = useState('');
  const [lead2, setLead2] = useState('');
  const [lead3, setLead3] = useState('');
  const [extraLeads, setExtraLeads] = useState<string[]>([]);
  const [assignedGeos, setAssignedGeos] = useState<string[]>([]);
  const [loadingGeos, setLoadingGeos] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
    attendanceMode: 'bus_based' as const,
    notes: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingGeos(true);
      try {
        const res = await getAllStaff({ role: 'staff', limit: 500 });
        const list = (res.data || [])
          .filter(isEligibleGeoLeadOrganizer)
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        if (cancelled) return;
        setGeoLeads(list);
        setLead1((prev) => prev || list[0]?.id || '');
      } catch {
        if (!cancelled) {
          setError('Could not load GEO staff. Try again or add GEOs in the directory.');
        }
      } finally {
        if (!cancelled) setLoadingGeos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead1) {
      setError('Select at least one GEO team leader.');
      return;
    }
    const slots = [lead1, lead2, lead3, ...extraLeads].filter(Boolean);
    const assigned = assignedGeos.filter(Boolean);
    if (new Set(slots).size !== slots.length) {
      setError('Team leaders must be different people.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const event = await createEvent({
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        location: formData.location || undefined,
        leadOrganizerId: lead1,
        leadOrganizer2Id: lead2 || null,
        leadOrganizer3Id: lead3 || null,
        leadOrganizerIds: slots,
        assignedGeoIds: assigned,
        attendanceMode: formData.attendanceMode as any,
        notes: formData.notes || undefined,
      });

      router.push(`/events/${event.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <PageLayout title="Create Event">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">Access denied. Admin privileges required.</p>
              <Button onClick={() => router.push('/events')} className="mt-4">
                Back to Events
              </Button>
            </CardContent>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title="Create Event"
        actions={
          <Button variant="outline" onClick={() => router.push('/events')}>
            Cancel
          </Button>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {loadingGeos ? (
                <div className="flex justify-center py-6">
                  <Spinner className="text-[#57068c]" />
                </div>
              ) : geoLeads.length === 0 ? (
                <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
                  No GEO staff found. Add GEOs in the GEO Directory before creating events.
                </div>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Name *
                  </label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter event name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <Input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <Input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <Input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <Input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <Input
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Enter location"
                  />
                </div>

                {!loadingGeos && geoLeads.length > 0 && (
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Team leader 1 (GEO) *
                      </label>
                      <Select
                        name="leadOrganizerId"
                        value={lead1}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLead1(v);
                          setLead2((l2) => (l2 === v ? '' : l2));
                          setLead3((l3) => (l3 === v ? '' : l3));
                          setExtraLeads((prev) => prev.map((id) => (id === v ? '' : id)));
                        }}
                        options={geoLeads.map((g) => ({
                          value: g.id,
                          label: g.position ? `${g.fullName} (${g.position})` : g.fullName,
                        }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Team leader 2 (optional)
                      </label>
                      <Select
                        name="leadOrganizer2Id"
                        value={lead2}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLead2(v);
                          setLead3((l3) => (l3 === v ? '' : l3));
                          setExtraLeads((prev) => prev.map((id) => (id === v ? '' : id)));
                        }}
                        options={[
                          { value: '', label: '— None —' },
                          ...geoLeads
                            .filter((g) => g.id !== lead1)
                            .map((g) => ({
                              value: g.id,
                              label: g.position ? `${g.fullName} (${g.position})` : g.fullName,
                            })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Team leader 3 (optional)
                      </label>
                      <Select
                        name="leadOrganizer3Id"
                        value={lead3}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLead3(v);
                          setExtraLeads((prev) => prev.map((id) => (id === v ? '' : id)));
                        }}
                        options={[
                          { value: '', label: '— None —' },
                          ...geoLeads
                            .filter((g) => g.id !== lead1 && g.id !== lead2)
                            .map((g) => ({
                              value: g.id,
                              label: g.position ? `${g.fullName} (${g.position})` : g.fullName,
                            })),
                        ]}
                      />
                    </div>
                    {extraLeads.map((leadId, index) => (
                      <div key={`extra-lead-${index}`}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Team leader {4 + index} (optional)
                        </label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={leadId}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExtraLeads((prev) => prev.map((id, i) => (i === index ? v : id)));
                            }}
                            options={[
                              { value: '', label: '— None —' },
                              ...geoLeads
                                .filter((g) => ![lead1, lead2, lead3, ...extraLeads.filter((_, i) => i !== index)].includes(g.id))
                                .map((g) => ({
                                  value: g.id,
                                  label: g.position ? `${g.fullName} (${g.position})` : g.fullName,
                                })),
                            ]}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExtraLeads((prev) => prev.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExtraLeads((prev) => [...prev, ''])}
                      >
                        + Add GEO Leader
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Add as many GEO team leaders as needed. Admins cannot be assigned as leads.
                    </p>
                  </div>
                )}

                {!loadingGeos && geoLeads.length > 0 && (
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Assigned GEOs (optional)
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAssignedGeos((prev) => [...prev, ''])}
                      >
                        + Add GEO
                      </Button>
                    </div>
                    {assignedGeos.length === 0 && (
                      <p className="text-xs text-gray-500">No extra GEOs assigned yet.</p>
                    )}
                    {assignedGeos.map((geoId, index) => (
                      <div key={`assigned-geo-${index}`} className="flex items-center gap-2">
                        <Select
                          value={geoId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAssignedGeos((prev) => prev.map((id, i) => (i === index ? v : id)));
                          }}
                          options={[
                            { value: '', label: '— None —' },
                            ...geoLeads
                              .filter((g) => !assignedGeos.filter((_, i) => i !== index).includes(g.id))
                              .map((g) => ({
                                value: g.id,
                                label: g.position ? `${g.fullName} (${g.position})` : g.fullName,
                              })),
                          ]}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignedGeos((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attendance Mode *
                  </label>
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    Bus Trip
                  </div>
                  <input type="hidden" name="attendanceMode" value="bus_based" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Enter any additional notes..."
                    rows={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/events')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    loading ||
                    loadingGeos ||
                    !formData.name ||
                    !formData.startDate ||
                    !lead1 ||
                    geoLeads.length === 0
                  }
                  isLoading={loading}
                >
                  Create Event
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageLayout>
    </ProtectedRoute>
  );
}

