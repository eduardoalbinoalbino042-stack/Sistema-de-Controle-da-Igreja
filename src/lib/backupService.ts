import * as XLSX from 'xlsx';
import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { logActivity } from './activityService';
import { confirmAction, showSuccess, showError } from './alerts';

export async function exportBackup(user: any, setIsBackupLoading: (loading: boolean) => void) {
  if (!user) return;
  setIsBackupLoading(true);
  try {
    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      start: doc.data().start instanceof Object && 'toDate' in doc.data().start ? doc.data().start.toDate().toISOString() : doc.data().start,
      end: doc.data().end instanceof Object && 'toDate' in doc.data().end ? doc.data().end.toDate().toISOString() : doc.data().end,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Eventos");
    
    const fileName = `Backup_Agenda_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    logActivity({
      userId: user.uid,
      userName: user.displayName || 'Usuário',
      action: 'Backup Exportado (Header)',
      details: `${data.length} eventos exportados para Excel.`,
      type: 'system'
    });
    
    showSuccess('Backup Concluído', `${data.length} eventos exportados com sucesso.`);
  } catch (err) {
    console.error('Erro ao exportar backup:', err);
    showError('Erro de Backup', 'Ocorreu um erro ao gerar o arquivo.');
  } finally {
    setIsBackupLoading(false);
  }
}

export async function importBackup(user: any, file: File, setIsBackupLoading: (loading: boolean) => void) {
  if (!file || !user) return;
  
  const confirmed = await confirmAction(
    'Importar Backup?',
    'Deseja restaurar os eventos desta planilha? Isso adicionará novos registros ao seu banco.'
  );

  if (!confirmed) return;
  
  setIsBackupLoading(true);
  const reader = new FileReader();

  reader.onload = async (event) => {
    try {
      const bstr = event.target?.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Planilha vazia ou formato inválido.');
      }

      const batch = writeBatch(db);
      data.forEach((item: any) => {
        const { id, ...cleanData } = item;
        const docRef = doc(collection(db, 'events'));
        batch.set(docRef, {
          ...cleanData,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      showSuccess('Restauração Concluída!', `${data.length} eventos foram importados do backup.`);
      
      logActivity({
        userId: user.uid,
        userName: user.displayName || 'Usuário',
        action: 'Backup Importado (Header)',
        details: `${data.length} eventos restaurados via Excel.`,
        type: 'system'
      });
    } catch (err) {
      console.error('Erro ao importar backup:', err);
      showError('Erro na Importação', 'Não foi possível processar o arquivo.');
    } finally {
      setIsBackupLoading(false);
    }
  };

  reader.readAsBinaryString(file);
}
