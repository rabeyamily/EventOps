import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const VIEWING_SEMESTER_KEY = 'eventops-viewing-semester';

interface ViewingSemesterState {
  viewingSemester: string | null;
  setViewingSemester: (semester: string | null) => void;
}

export const useViewingSemesterStore = create<ViewingSemesterState>()(
  persist(
    (set) => ({
      viewingSemester: null,
      setViewingSemester: (semester) => set({ viewingSemester: semester }),
    }),
    { name: VIEWING_SEMESTER_KEY }
  )
);
