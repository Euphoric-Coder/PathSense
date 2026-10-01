import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBarrierReports, deleteBarrierReport } from './src/services/barrierStorage';

const STORAGE_KEY = '@pathsense_barrier_reports';

async function wipe() {
  const reports = await getBarrierReports();
  console.log('Total reports:', reports.length);
  for (const r of reports) {
    if (r.id.startsWith('mock-debug-barrier') || r.id.startsWith('BR-')) {
      await deleteBarrierReport(r.id);
      console.log('Deleted', r.id);
    }
  }
}
wipe();
