import { hasPermission, Permission } from './rbac';
import { StaffRole } from '../models/Staff';

describe('hasPermission', () => {
  it('grants admins all permissions', () => {
    expect(hasPermission(StaffRole.ADMIN, Permission.DELETE_STUDENT)).toBe(true);
  });

  it('denies staff permissions they do not have', () => {
    expect(hasPermission(StaffRole.STAFF, Permission.DELETE_STUDENT)).toBe(false);
  });

  it('grants staff view_students', () => {
    expect(hasPermission(StaffRole.STAFF, Permission.VIEW_STUDENTS)).toBe(true);
  });
});
