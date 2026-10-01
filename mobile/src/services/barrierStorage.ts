import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarrierReport } from '../types/pathsense';

const STORAGE_KEY = '@pathsense_barrier_reports';

export const getBarrierReports = async (): Promise<BarrierReport[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading barrier reports', error);
    return [];
  }
};

export const saveBarrierReport = async (report: BarrierReport): Promise<void> => {
  try {
    const existing = await getBarrierReports();
    const updated = [...existing, report];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving barrier report', error);
  }
};

export const updateBarrierReport = async (report: BarrierReport): Promise<void> => {
  try {
    const existing = await getBarrierReports();
    const updated = existing.map((r) => (r.id === report.id ? report : r));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating barrier report', error);
  }
};

export const deleteBarrierReport = async (id: string): Promise<void> => {
  try {
    const existing = await getBarrierReports();
    const updated = existing.filter((r) => r.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting barrier report', error);
  }
};

export const clearUserBarrierReports = async (): Promise<void> => {
  try {
    const existing = await getBarrierReports();
    // Only remove user-created ones (not mocks, though mocks might be stored elsewhere)
    const updated = existing.filter((r) => r.isMock);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error clearing user barrier reports', error);
  }
};
