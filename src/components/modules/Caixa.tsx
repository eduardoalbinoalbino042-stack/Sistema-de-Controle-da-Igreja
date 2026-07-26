import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  Search, 
  Plus, 
  Settings, 
  Filter,
  MoreHorizontal,
  CreditCard,
  ChevronDown,
  ExternalLink,
  Receipt,
  LayoutDashboard,
  ArrowRightLeft,
  X,
  Loader2,
  Trash2,
  Edit3,
  ChevronUp,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Printer,
  Upload,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { addMonths, format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { showSuccess, showError, confirmAction, confirmInstallmentAction } from '../../lib/alerts';

const pieColors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6'];

const RELATORIOS = [
  { id: 'fluxo_mensal', title: 'Relatório de Fluxo de Caixa', desc: 'Resumo detalhado de entradas e saídas do mês.', icon: TrendingUp, color: 'text-emerald-500' },
  { id: 'departamentos', title: 'Saídas por Departamento', desc: 'Distribuição de gastos por ministérios e setores.', icon: PieChartIcon, color: 'text-indigo-500' },
  { id: 'balancete', title: 'Balancete Anual', desc: 'Visão macro do ano completo para assembleia.', icon: FileText, color: 'text-blue-500' },
  { id: 'pendencias', title: 'Relatório de Pendências', desc: 'Contas a pagar e receber que ainda não foram liquidadas.', icon: Calendar, color: 'text-amber-500' },
];

const safeFormatDate = (dateStr: string) => {
  try {
    if (!dateStr) return '--/--/--';
    const parsed = parseISO(dateStr);
    return format(parsed, 'dd/MM/yy');
  } catch (e) {
    return '--/--/--';
  }
};

export default function Caixa() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('geral');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'MM'));

  const generatePDF = (type: string) => {
    try {
      const doc = new jsPDF();
      const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
      const period = type === 'balancete' ? reportYear : `${reportMonth}/${reportYear}`;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(30, 27, 75); // Indigo 950
      doc.text("RELATÓRIO FINANCEIRO", 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`${(churchName || 'NOME DA IGREJA').toUpperCase()} | Emissão: ${timestamp}`, 105, 28, { align: 'center' });
      
      const subtitlePrefix = type === 'balancete' ? 'Exercício de' : 'Período de Referência:';
      doc.text(`${subtitlePrefix} ${period}`, 105, 33, { align: 'center' });
      
      doc.setDrawColor(200);
      doc.line(20, 40, 190, 40);

      let reportTitle = "";
      let tableData: any[] = [];
      let tableHeaders: any[] = [];

      // Para pendências, ignoramos o filtro de mês para mostrar TUDO o que está aberto, facilitando a vida do tesoureiro
      const isYearly = reportMonth === 'all';
      const filteredReportData = type === 'pendencias' 
        ? listaTransacoes.filter(t => {
            const [y] = (t.rawDate || '').split('-');
            return y === reportYear.toString() && t.status === 'Pendente';
          })
        : listaTransacoes.filter(t => {
            const [y, m] = (t.rawDate || '').split('-');
            const yearMatch = y === reportYear.toString();
            return isYearly ? yearMatch : (yearMatch && m === reportMonth);
          });

      const annualReportData = listaTransacoes.filter(t => {
        const [y] = (t.rawDate || '').split('-');
        return y === reportYear.toString();
      });

      if (type === 'fluxo_mensal') {
        reportTitle = "Demonstrativo de Fluxo de Caixa Mensal";
        const entries = filteredReportData.filter(t => t.type === 'entrada' && t.status === 'Recebido');
        const exits = filteredReportData.filter(t => t.type === 'saida' && t.status === 'Pago');
        
        tableHeaders = [['DATA', 'DESCRIÇÃO', 'TIPO', 'VALOR']];
        tableData = [...entries, ...exits]
          .sort((a, b) => (a.rawDate || '').localeCompare(b.rawDate || ''))
          .map(t => [
            t.rawDate ? format(parseISO(t.rawDate), 'dd/MM/yy') : '--/--/--',
            t.description || t.payerRecipient || 'S/ Identificação',
            t.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
            `R$ ${Number(t.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ]);

        const totalEntradas = entries.reduce((acc, t) => acc + Number(t.value), 0);
        const totalSaidas = exits.reduce((acc, t) => acc + Number(t.value), 0);
        const saldo = totalEntradas - totalSaidas;

        doc.setFontSize(14);
        doc.text(reportTitle, 20, 50);
        
        autoTable(doc, {
          head: tableHeaders,
          body: tableData,
          startY: 55,
          theme: 'striped',
          headStyles: { fillColor: [30, 27, 75], fontSize: 10 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          styles: { fontSize: 9 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(`Total de Entradas: R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY, { align: 'right' });
        doc.text(`Total de Saídas: R$ ${totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 7, { align: 'right' });
        doc.setFont(undefined, 'bold');
        doc.text(`Saldo Final do Período: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 14, { align: 'right' });
      } 
      else if (type === 'departamentos') {
        reportTitle = "Saídas por Centro de Custo / Departamento";
        const exits = filteredReportData.filter(t => t.type === 'saida' && t.status === 'Pago');
        const byDept: any = {};
        exits.forEach(t => {
          const dept = t.costCenter || 'NÃO CATEGORIZADO';
          byDept[dept] = (byDept[dept] || 0) + Number(t.value);
        });

        tableHeaders = [['DEPARTAMENTO / CENTRO DE CUSTO', 'VALOR ACUMULADO', '% DO TOTAL']];
        const total = exits.reduce((acc, t) => acc + Number(t.value), 0);
        
        const sortedDepts = Object.entries(byDept).sort((a: any, b: any) => b[1] - a[1]);
        
        tableData = sortedDepts.map(([dept, val]: [string, any]) => [
          dept.toUpperCase(),
          `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%`
        ]);

        doc.setFontSize(14);
        doc.text(reportTitle, 20, 50);
        
        autoTable(doc, {
          head: tableHeaders,
          body: tableData,
          startY: 55,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] },
          styles: { fontSize: 10 }
        });
      }
      else if (type === 'balancete') {
        reportTitle = `Balancete Ministerial Eclesiástico - Ano ${reportYear}`;
        const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        let runningBalance = 0;
        tableHeaders = [['Mês', 'Entradas', 'Saídas', 'Mensal', 'Acumulado']];
        tableData = months.map((m, idx) => {
          const periodData = annualReportData.filter(t => (t.rawDate || '').split('-')[1] === m);
          const entries = periodData.filter(t => t.type === 'entrada' && t.status === 'Recebido').reduce((acc, t) => acc + Number(t.value), 0);
          const exits = periodData.filter(t => t.type === 'saida' && t.status === 'Pago').reduce((acc, t) => acc + Number(t.value), 0);
          const mensal = entries - exits;
          runningBalance += mensal;
          
          return [
            monthNames[idx],
            `R$ ${entries.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${exits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${runningBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ];
        });

        doc.setFontSize(14);
        doc.text(reportTitle, 20, 50);
        
        autoTable(doc, {
          head: tableHeaders,
          body: tableData,
          startY: 55,
          theme: 'striped',
          headStyles: { fillColor: [30, 27, 75] },
          styles: { fontSize: 9 }
        });
      }
      else if (type === 'pendencias') {
        reportTitle = "Relatório de Pendências Financeiras (Contas em Aberto)";
        const entriesP = filteredReportData.filter(t => t.type === 'entrada' && t.status === 'Pendente');
        const exitsP = filteredReportData.filter(t => t.type === 'saida' && t.status === 'Pendente');
        
        tableHeaders = [['DATA PREV.', 'DESCRIÇÃO', 'TIPO', 'SITUAÇÃO', 'VALOR']];
        tableData = [...entriesP, ...exitsP]
          .sort((a, b) => (a.rawDate || '').localeCompare(b.rawDate || ''))
          .map(t => [
            t.rawDate ? format(parseISO(t.rawDate), 'dd/MM/yy') : '---',
            t.description || t.payerRecipient || 'S/ Identificação',
            t.type === 'entrada' ? 'A RECEBER' : 'A PAGAR',
            'PENDENTE',
            `R$ ${Number(t.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ]);

        doc.setFontSize(14);
        doc.text(reportTitle, 20, 50);
        
        autoTable(doc, {
          head: tableHeaders,
          body: tableData,
          startY: 55,
          theme: 'striped',
          headStyles: { fillColor: [245, 158, 11] },
          styles: { fontSize: 9 }
        });
      }

      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      const pageHeight = doc.internal.pageSize.height;
      if (finalY + 45 > pageHeight) doc.addPage();
      const signatureY = pageHeight - 35;
      
      doc.setDrawColor(150);
      doc.line(30, signatureY, 90, signatureY);
      doc.setFontSize(9);
      doc.text("Tesouraria", 60, signatureY + 5, { align: 'center' });
      
      doc.line(120, signatureY, 180, signatureY);
      doc.text("Presidência", 150, signatureY + 5, { align: 'center' });

      // Em vez de salvar, abre em uma nova aba
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      showError("Erro técnico", "Não foi possível gerar o PDF. Verifique se o bloqueador de pop-ups está ativo.");
    }
  };

  const generateCarnePDF = (t: any) => {
    try {
      const relatedInstallments = t.groupId 
        ? listaTransacoes.filter(it => it.groupId === t.groupId).sort((a, b) => a.currentInstallment - b.currentInstallment)
        : [t];

      // Add to cover queue automatically
      if (t.payerRecipient) {
        addToCoverQueue(t.payerRecipient);
      }

      const doc = new jsPDF('p', 'mm', 'a4');
      const churchNameTitle = churchName || 'NOME DA IGREJA';
      const logo = churchLogos[0];

      relatedInstallments.forEach((inst, index) => {
        const slotIndex = index % 5;
        if (slotIndex === 0 && index > 0) {
          doc.addPage();
        }

        const yOffset = slotIndex * 58;

        // Draw Container with light border
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.rect(10, 10 + yOffset, 190, 52); 
        doc.line(65, 10 + yOffset, 65, 62 + yOffset); // Divider

        // --- STUB PART (LEFT) ---
        const stubX = 12;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        
        // Nome
        doc.text("Nome", stubX, 15 + yOffset);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.setFontSize(8);
        doc.text((inst.payerRecipient || "---").toUpperCase(), stubX, 19 + yOffset);
        doc.setDrawColor(80); // Darker lines
        doc.line(stubX, 20.5 + yOffset, 63, 20.5 + yOffset);

        // Parcela
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text("Parcela", stubX, 25 + yOffset);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`Parcela ${inst.currentInstallment} de ${inst.installments}`, stubX, 29 + yOffset);
        doc.line(stubX, 30.5 + yOffset, 63, 30.5 + yOffset);

        // Inverting Valor Total and Valor da Parcela as requested
        // Valor da Parcela
        const partValue = inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text("Valor da Parcela", stubX, 35 + yOffset);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`R$ ${partValue}`, 63, 39 + yOffset, { align: 'right' });
        doc.line(stubX, 40.5 + yOffset, 63, 40.5 + yOffset);

        // Valor Total
        const totalValue = (inst.value * inst.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text("Valor Total", stubX, 45 + yOffset);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(`R$ ${totalValue}`, 63, 49 + yOffset, { align: 'right' });
        doc.line(stubX, 50.5 + yOffset, 63, 50.5 + yOffset);

        // Vencimento
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text("Vencimento", stubX, 55 + yOffset);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(safeFormatDate(inst.rawDate), 63, 59 + yOffset, { align: 'right' });
        doc.line(stubX, 61 + yOffset, 63, 61 + yOffset);

        // --- MAIN PART (RIGHT) ---
        // Logo
        if (logo) {
          try {
            doc.addImage(logo, 'PNG', 68, 12 + yOffset, 28, 28);
          } catch(e) {
            console.warn("Logo failed to load for PDf", e);
          }
        } else {
          // Placeholder for logo area
          doc.setDrawColor(200);
          doc.rect(68, 12 + yOffset, 28, 28);
          doc.setFontSize(6);
          doc.text("LOGO", 82, 26 + yOffset, { align: 'center' });
        }

        // Church Name (Title)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(churchNameTitle, 98, 18 + yOffset);

        // Description (Middle)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text((inst.description || inst.operationNature || 'Contribuição').toUpperCase(), 98, 26 + yOffset);

        // Member Name (Middle)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const nameText = (inst.payerRecipient || "---").toUpperCase();
        doc.text(nameText, 98, 36 + yOffset);
        const nameWidth = doc.getTextWidth(nameText);
        doc.setDrawColor(0);
        doc.line(98, 36.8 + yOffset, 98 + nameWidth, 36.8 + yOffset);

        // Bottom Details
        const footerY = 50 + yOffset;
        const mainStubX = 70;
        const rightColX = 180;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        
        // Col 1: Swapped Parcela to here
        doc.text("Parcela", mainStubX, footerY - 5);
        doc.text("Valor Total", mainStubX, footerY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text(`Parcela ${inst.currentInstallment} de ${inst.installments}`, mainStubX, footerY);
        doc.text(`R$ ${totalValue}`, mainStubX, footerY + 10);
        
        doc.setDrawColor(100); // Darker lines
        doc.line(mainStubX, footerY + 1, mainStubX + 40, footerY + 1);
        doc.line(mainStubX, footerY + 11, mainStubX + 40, footerY + 11);

        // Col 2: Swapped Valor da Parcela to here
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text("Valor da Parcela", rightColX + 18, footerY - 5, { align: 'right' });
        doc.text("Data Vencimento", rightColX + 18, footerY + 5, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text(`R$ ${partValue}`, rightColX + 18, footerY, { align: 'right' });
        doc.text(safeFormatDate(inst.rawDate), rightColX + 18, footerY + 10, { align: 'right' });

        doc.setDrawColor(100);
        doc.line(rightColX - 15, footerY + 1, rightColX + 18, footerY + 1);
        doc.line(rightColX - 15, footerY + 11, rightColX + 18, footerY + 11);

        // Cut line indicator
        if (slotIndex < 4) {
          doc.setDrawColor(220);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(5, 65 + yOffset, 205, 65 + yOffset);
          doc.setLineDashPattern([], 0);
        }
      });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error("Erro ao gerar Carnê:", err);
      showError("Erro ao gerar Carnê", "Verifique se o bloqueador de pop-ups está ativo.");
    }
  };

  const numberToWords = (n: number) => {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (n === 0) return 'zero reais';

    const integerPart = Math.floor(n);
    const decimalPart = Math.round((n - integerPart) * 100);

    const getGroup = (num: number) => {
      if (num === 100) return 'cem';
      let res = hundreds[Math.floor(num / 100)];
      let rem = num % 100;
      if (rem > 0) {
        if (res !== '') res += ' e ';
        if (rem < 10) res += units[rem];
        else if (rem < 20) res += teens[rem - 10];
        else {
          res += tens[Math.floor(rem / 10)];
          if (rem % 10 > 0) res += ' e ' + units[rem % 10];
        }
      }
      return res;
    };

    let words = '';
    if (integerPart >= 1000) {
      const mil = Math.floor(integerPart / 1000);
      const rem = integerPart % 1000;
      words += (mil === 1 ? '' : getGroup(mil)) + ' mil';
      if (rem > 0) {
        words += (rem < 100 || rem % 100 === 0 ? ' e ' : ' ') + getGroup(rem);
      }
    } else {
      words = getGroup(integerPart);
    }

    let res = words + (integerPart === 1 ? ' real' : ' reais');
    if (decimalPart > 0) {
      let centavosWords = '';
      if (decimalPart < 10) centavosWords = units[decimalPart];
      else if (decimalPart < 20) centavosWords = teens[decimalPart - 10];
      else {
        centavosWords = tens[Math.floor(decimalPart / 10)];
        if (decimalPart % 10 > 0) centavosWords += ' e ' + units[decimalPart % 10];
      }
      res += ' e ' + centavosWords + (decimalPart === 1 ? ' centavo' : ' centavos');
    }

    return res + ' ' + '*+'.repeat(20);
  };

  const generateReceiptPDF = (t: any) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const churchNameTitle = churchName || 'NOME DA IGREJA';
      const logo = churchLogos[0];
      const receiptNo = (t.id || '000').slice(-4).toUpperCase();
      const valueStr = Number(t.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const natureStr = (t.description || t.operationNature || 'Pagamento').toUpperCase();

      const drawReceipt = (yOffset: number) => {
        // Outer border
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(10, 10 + yOffset, 190, 125);

        // Header - Using Social Name as requested
        const topTitle = (churchInfo.socialName || churchName || 'IGREJA').toUpperCase();
        doc.setFontSize(14);
        doc.setFont('times', 'bold');
        doc.text(topTitle, 105, 18 + yOffset, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        // Full Address in Header - More robust formatting
        const headerParts = [
          churchInfo.address,
          churchInfo.number ? `${churchInfo.number}${churchInfo.complement ? ' ' + churchInfo.complement : ''}` : null,
          churchInfo.neighborhood ? `Bairro ${churchInfo.neighborhood.replace(/^bairro\s+/i, '')}` : null,
          churchInfo.city ? `${churchInfo.city}${churchInfo.state ? '-' + churchInfo.state : ''}` : null
        ].filter(Boolean);
        const headerAddr = headerParts.join(' - ');
        doc.text(headerAddr, 105, 23 + yOffset, { align: 'center' });
        doc.text(`CNPJ ${churchInfo.cnpj || '---'}  Cel: ${churchInfo.phone || '---'}`, 105, 27 + yOffset, { align: 'center' });

        // Bar Section
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.rect(15, 33 + yOffset, 180, 8); // Outline instead of fill
        
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Recibo Nº`, 17, 38.5 + yOffset);
        
        // No box - Removed borders as requested
        doc.setFillColor(230, 230, 230);
        doc.rect(65, 34 + yOffset, 25, 6, 'F');
        doc.setTextColor(0);
        doc.text(receiptNo, 77.5, 38.5 + yOffset, { align: 'center' });

        doc.text(`VALOR`, 135, 38.5 + yOffset);

        // Value box - Removed borders as requested
        doc.setFillColor(230, 230, 230);
        doc.rect(150, 34 + yOffset, 40, 6, 'F');
        doc.setTextColor(0);
        doc.text(`R$ ${valueStr}`, 170, 38.5 + yOffset, { align: 'center' });

        // Lookup recipient details
        const recipient = fornecedoresMapeados.find(f => 
          f.name?.toString().toLowerCase().trim() === t.payerRecipient?.toString().toLowerCase().trim()
        );
        const recipientAddr = [
          recipient?.address,
          recipient?.neighborhood ? `Bairro ${recipient.neighborhood.replace(/^bairro\s+/i, '')}` : null
        ].filter(Boolean).join(' - ') || "";
        const recipientNum = recipient?.number || "";
        const recipientDoc = recipient?.doc || "---.---.---";

        // Body
        doc.setTextColor(0);
        doc.setFontSize(11);
        doc.setFont('times', 'normal');
        
        // Recebi de
        doc.text("Recebi de: ", 15, 50 + yOffset);
        const payerText = topTitle;
        doc.text(payerText, 35, 50 + yOffset);
        doc.line(35, 51 + yOffset, 190, 51 + yOffset);

        // A quantia de
        doc.text("A quantia de: ", 15, 60 + yOffset);
        doc.setFillColor(235, 235, 235);
        doc.rect(40, 56 + yOffset, 150, 6, 'F');
        doc.setFontSize(10);
        doc.text(numberToWords(Number(t.value)).toUpperCase(), 42, 60 + yOffset);

        // Referente à
        doc.setFontSize(11);
        doc.text("Referente à: ", 15, 70 + yOffset);
        doc.text(t.description || t.operationNature || 'Serviços/Materiais', 35, 70 + yOffset);
        doc.line(35, 71 + yOffset, 190, 71 + yOffset);

        // Endereço - Using recipient address
        doc.text("Endereço: ", 15, 80 + yOffset);
        doc.text(recipientAddr, 35, 80 + yOffset);
        doc.line(35, 81 + yOffset, 160, 81 + yOffset);
        doc.text("Nº: ", 165, 80 + yOffset);
        doc.text(recipientNum || "---", 175, 80 + yOffset);
        doc.line(175, 81 + yOffset, 190, 81 + yOffset);

        doc.text("E por ser verdade, firmo e assino !", 15, 90 + yOffset);

        // Date Line
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const now = new Date();
        const cityUpper = (churchInfo.city || 'Maracaí').toUpperCase();
        const dateLine = `${cityUpper}, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
        doc.text(dateLine, 110, 100 + yOffset);
        doc.line(110, 101 + yOffset, 190, 101 + yOffset);

        // Footer Signature
        const recipientName = (t.payerRecipient || "---").toUpperCase();
        doc.line(60, 112 + yOffset, 150, 112 + yOffset);
        doc.setFont('helvetica', 'bold');
        doc.text(recipientName, 105, 116 + yOffset, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text("CPF/CNPJ:", 80, 121 + yOffset);
        doc.text(recipientDoc, 100, 121 + yOffset);
      };

      drawReceipt(0);
      
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error("Erro ao gerar Recibo:", err);
      showError("Erro ao gerar Recibo", "Verifique se o bloqueador de pop-ups está ativo.");
    }
  };

  const [activeMonth, setActiveMonth] = useState(() => {
    const now = new Date();
    const ySuffix = now.getFullYear().toString().slice(-2);
    // Default to "Ano Inteiro" on load
    return `all-${ySuffix}`;
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [chartFilter, setChartFilter] = useState<'mensal' | 'anual'>('anual');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'entrada' | 'saida' | 'transferencia'>('entrada');
  const [modalNature, setModalNature] = useState('');
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState(() => {
    const year = 2026; // Base year for the system context
    return Array.from({ length: 7 }, (_, i) => year - 3 + i);
  });
  const [churchName, setChurchName] = useState('NOME DA IGREJA');
  const [churchInfo, setChurchInfo] = useState({
    cnpj: '',
    address: '',
    city: '',
    phone: '',
    socialName: '',
    neighborhood: '',
    state: '',
    number: '',
    complement: '',
    zipCode: ''
  });
  const [churchLogos, setChurchLogos] = useState<string[]>([]);
  
  // States for Carnê Covers
  const [coverQueue, setCoverQueue] = useState<string[]>(() => {
    const saved = localStorage.getItem('church_cover_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [coverConfig, setCoverConfig] = useState({
    campaignTitle: 'CAMPANHA MESA DE SOM',
    bgImage: ''
  });
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const coverBgInputRef = React.useRef<HTMLInputElement>(null);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  const handleCoverBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showError("Arquivo muito grande", "A imagem deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverConfig(prev => ({ ...prev, bgImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    localStorage.setItem('church_cover_queue', JSON.stringify(coverQueue));
  }, [coverQueue]);

  const addToCoverQueue = (name: string) => {
    if (!name) return;
    setCoverQueue(prev => {
      if (prev.includes(name)) return prev;
      return [...prev, name];
    });
  };

  const generateCoversPDF = () => {
    if (coverQueue.length === 0) {
      showError("Fila de Capas Vazia", "Imprima alguns carnês primeiro ou adicione nomes manualmente.");
      return;
    }

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const logo = churchLogos[0];

      // 5 covers per page
      coverQueue.forEach((name, index) => {
        const slotIndex = index % 5;
        const yOffset = slotIndex * 58;

        if (index > 0 && slotIndex === 0) {
          doc.addPage();
        }

        // Background - Reduced margins to 5mm
        if (coverConfig.bgImage) {
          try {
            doc.addImage(coverConfig.bgImage, 'JPEG', 5, 10 + yOffset, 200, 52);
          } catch (e) {
            console.warn("Background failed", e);
            doc.setDrawColor(230);
            doc.rect(5, 10 + yOffset, 200, 52);
          }
        } else {
          doc.setDrawColor(230);
          doc.rect(5, 10 + yOffset, 200, 52);
        }

        // Logo on covers
        if (logo) {
          try {
            doc.addImage(logo, 'PNG', 18, 14 + yOffset, 35, 42);
          } catch (e) { console.warn(e); }
        }

        doc.setTextColor(30, 41, 59);
        // Campaign Title - Size 14, shifted up
        doc.setFontSize(14);
        doc.setFont('times', 'bold');
        doc.text(coverConfig.campaignTitle.toUpperCase(), 60, 24 + yOffset);

        // Name - Size 12, shifted up
        doc.setFontSize(12);
        doc.setFont('times', 'bold');
        doc.text(name.toUpperCase(), 60, 38 + yOffset);

        // Cut line
        if (slotIndex < 4) {
          doc.setDrawColor(220);
          doc.setLineDashPattern([2, 1], 0);
          doc.line(5, 65 + yOffset, 205, 65 + yOffset);
          doc.setLineDashPattern([], 0);
        }
      });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error("Erro ao gerar Capas:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    const churchRef = doc(db, 'church_data', user.uid);
    const unsubscribe = onSnapshot(churchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChurchName(data.ministry || data.socialName || 'NOME DA IGREJA');
        setChurchInfo({
          cnpj: data.cnpj || '',
          address: data.address || '',
          city: data.city || '',
          phone: data.phone || '',
          socialName: data.socialName || '',
          neighborhood: data.neighborhood || '',
          state: data.state || '',
          number: data.number || '',
          complement: data.complement || '',
          zipCode: data.zipCode || ''
        });
        setChurchLogos(data.logos || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'church_data');
    });
    return () => unsubscribe();
  }, [user]);

  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [fornecedoresMapeados, setFornecedoresMapeados] = useState<any[]>([]);
  const [membrosCadastrados, setMembrosCadastrados] = useState<any[]>([]);

  const [historicoNomes, setHistoricoNomes] = useState<string[]>(() => {
    const saved = localStorage.getItem('church_records_names');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [historicoCentros, setHistoricoCentros] = useState<string[]>(() => {
    const saved = localStorage.getItem('church_records_centers');
    return saved ? JSON.parse(saved) : ['Administração', 'Templo / Sede', 'Ministério de Louvor', 'Ministério Infantil', 'Missões', 'Ação Social', 'Eventos'];
  });

  const [listaTransacoes, setListaTransacoes] = useState<any[]>([]);
  const [numParcelas, setNumParcelas] = useState(1);
  const [billingConfig, setBillingConfig] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'billing_config', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setBillingConfig(docSnap.data().methods);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const adjustDateByBillingConfig = (originalDate: string, paymentMethod: string) => {
    if (!billingConfig || !billingConfig[paymentMethod]) return originalDate;
    
    const { closingDay, dueDay } = billingConfig[paymentMethod];
    try {
      const date = parseISO(originalDate);
      const day = date.getDate();
      
      let targetDate = new Date(date.getFullYear(), date.getMonth(), dueDay);

      if (day > closingDay) {
        // Se o dia da compra for após o fechamento, o vencimento vai para o próximo mês
        targetDate = addMonths(targetDate, 1);
      }
      
      return format(targetDate, 'yyyy-MM-dd');
    } catch (e) {
      return originalDate;
    }
  };
  const [searchTermCaixa, setSearchTermCaixa] = useState('');
  const [confirmStep, setConfirmStep] = useState<'none' | 'ask' | 'success'>('none');
  const [pendingData, setPendingData] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isBatchPayment, setIsBatchPayment] = useState(false);

  const handleFinalSave = async (isBatchChoice: boolean) => {
    if (!user || !pendingData) {
      console.error("Save aborted: No user or pending data", { user: !!user, pendingData });
      return;
    }
    
    const { date, nature, center, status, name, description, valor, payment } = pendingData;
    
    if (name) {
      try {
        // Detailed validation
        if (!date) throw new Error('Data é obrigatória');
        if (!valor) throw new Error('Valor é obrigatório');

        salvarRegistro(name, center || '');
        
        // Improved currency parsing: remove everything except digits, comma and minus
        // then replace comma with dot. This handles "1.000,00" -> "1000.00"
        const cleanValor = valor.replace(/[^\d,.-]/g, '');
        let finalValorStr = cleanValor;
        
        // If both . and , are present, assume . is thousands and , is decimal
        if (cleanValor.includes('.') && cleanValor.includes(',')) {
          finalValorStr = cleanValor.replace(/\./g, '').replace(',', '.');
        } else if (cleanValor.includes(',')) {
          // If only , is present, treat as decimal
          finalValorStr = cleanValor.replace(',', '.');
        }
        
        const totalValor = parseFloat(finalValorStr) || 0;
        
        if (totalValor <= 0) {
          throw new Error('O valor deve ser maior que zero');
        }

        const valorParcela = numParcelas > 1 ? totalValor / numParcelas : totalValor;
        
        const baseDate = parseISO(date);
        if (isNaN(baseDate.getTime())) {
          throw new Error('Data inválida');
        }
        
        const promises = [];
        const groupId = numParcelas > 1 ? `group_${Date.now()}` : null;

        if (editingId) {
          // Single or Group edit mode
          const transactionData: any = {
            date: date,
            type: modalType,
            operationNature: nature || 'Outros',
            costCenter: center || '',
            status: status || 'Pendente',
            payerRecipient: name,
            description: description || '',
            value: totalValor,
            paymentMethod: payment || 'Pix',
            updatedAt: new Date().toISOString()
          };

          if (isBatchChoice) {
            // Se for pagamento em lote, busca todas as pendentes do grupo
            const currentT = listaTransacoes.find(it => it.id === editingId);
            if (currentT?.groupId) {
              const groupPending = listaTransacoes.filter(it => 
                it.groupId === currentT.groupId && 
                it.status === 'Pendente'
              );
              
              const batchPromises = groupPending.map(it => 
                updateDoc(doc(db, 'church_transactions', it.id), {
                  status: status || (modalType === 'entrada' ? 'Recebido' : 'Pago'),
                  updatedAt: new Date().toISOString()
                })
              );
              await Promise.all(batchPromises);
            }
          } else {
            await updateDoc(doc(db, 'church_transactions', editingId), transactionData);
          }
        } else {
          for (let i = 0; i < numParcelas; i++) {
            const nextDate = addMonths(baseDate, i);
            const formattedDate = format(nextDate, 'yyyy-MM-dd');
            
            const transactionData = {
              userId: user.uid,
              date: formattedDate,
              type: modalType,
              operationNature: nature || 'Outros',
              costCenter: center || '',
              status: status || 'Pendente',
              payerRecipient: name,
              description: description || '',
              value: valorParcela,
              installments: numParcelas,
              currentInstallment: i + 1,
              groupId: groupId,
              paymentMethod: payment || 'Pix',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            promises.push(addDoc(collection(db, 'church_transactions'), transactionData));
          }
          await Promise.all(promises);
        }
        
        showSuccess(numParcelas > 1 && !editingId ? `${numParcelas} parcelas registradas com sucesso!` : 'Lançamento salvo com sucesso!');
        setConfirmStep('success');
        setPendingData(null);
        setEditingId(null);
        
        setTimeout(() => {
          setIsModalOpen(false);
          setConfirmStep('none');
        }, 2000);
      } catch (error: any) {
        console.error("Error saving transaction:", error);
        showError(error.message || 'Erro ao realizar lançamento.');
      }
    }
  };

  const openNewModal = (type: 'entrada' | 'saida' | 'transferencia') => {
    setModalType(type);
    setModalNature(type === 'entrada' ? 'Dízimos' : type === 'saida' ? 'Manutenção' : 'Transferência');
    setNumParcelas(1);
    setEditingId(null);
    setPendingData(null);
    setIsEditingPayment(false);
    setIsBatchPayment(false);
    setConfirmStep('none');
    setIsModalOpen(true);
  };

  const handlePayInstallment = (id: string, type: 'entrada' | 'saida') => {
    const t = listaTransacoes.find(item => item.id === id);
    if (!t) return;
    handleEdit(t, true);
  };

  const handleDelete = async (t: any) => {
    if (t.groupId) {
      const option = await confirmInstallmentAction('delete');
      if (!option) return;
      
      try {
        if (option === 'series') {
          const itemsToDelete = listaTransacoes.filter(it => it.groupId === t.groupId);
          await Promise.all(itemsToDelete.map(it => deleteDoc(doc(db, 'church_transactions', it.id))));
          showSuccess('Todas as parcelas foram excluídas!');
        } else {
          await deleteDoc(doc(db, 'church_transactions', t.id));
          showSuccess('Parcela excluída com sucesso!');
        }
      } catch (error) {
        showError('Erro ao excluir registro(s).');
      }
    } else {
      const confirm = await confirmAction('Deseja realmente excluir este registro?', 'Esta ação não poderá ser desfeita.');
      if (confirm) {
        try {
          await deleteDoc(doc(db, 'church_transactions', t.id));
          showSuccess('Registro excluído com sucesso!');
        } catch (error) {
          showError('Erro ao excluir registro.');
        }
      }
    }
  };

  const handleClearAllDatabase = async () => {
    const confirm1 = await confirmAction('Atenção: Limpar Caixa', 'Você está prestes a excluir TODOS os registros de banco de dados do seu caixa. Tem certeza?');
    if (!confirm1) return;

    const confirm2 = await confirmAction('CONFIRMAÇÃO FINAL', 'Esta ação é completamente irreversível. Deseja realmente APAGAR TODOS os dados?', 'Sim, Apagar Tudo', 'Cancelar', '#ef4444');
    if (confirm2) {
      try {
        setLoading(true);
        const batchDeletes = listaTransacoes.map(t => deleteDoc(doc(db, 'church_transactions', t.id)));
        await Promise.all(batchDeletes);
        localStorage.removeItem('church_records_names');
        localStorage.removeItem('church_records_centers');
        setHistoricoNomes([]);
        setHistoricoCentros([]);
        showSuccess('Todos os dados foram excluídos permanentemente.');
      } catch (error) {
        showError('Erro ao limpar banco de dados.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (t: any, isPaymentOnly = false, batchPayment = false) => {
    setEditingId(t.id);
    setIsEditingPayment(isPaymentOnly);
    setIsBatchPayment(batchPayment);
    setModalType(t.type);
    setModalNature(t.operationNature || '');
    setNumParcelas(1); // Editing single installment for now
    setIsModalOpen(true);
    
    // Use timeout to let the modal open and inputs render
    setTimeout(() => {
      const dateInput = document.getElementById('modal-date-input') as HTMLInputElement;
      const natureInput = document.getElementById('modal-nature-input') as HTMLSelectElement;
      const centerInput = document.getElementById('modal-center-input') as HTMLInputElement;
      const statusInput = document.getElementById('modal-status-input') as HTMLSelectElement;
      const nameInput = document.getElementById('modal-name-input') as HTMLInputElement;
      const descriptionInput = document.getElementById('modal-description-input') as HTMLInputElement;
      const valueInput = document.getElementById('modal-value-input') as HTMLInputElement;
      const paymentInput = document.getElementById('modal-payment-input') as HTMLSelectElement;

      if (dateInput) dateInput.value = t.date;
      if (natureInput) natureInput.value = t.operationNature;
      if (centerInput) centerInput.value = t.costCenter;
      if (statusInput) {
        statusInput.value = isPaymentOnly ? (t.type === 'entrada' ? 'Recebido' : 'Pago') : t.status;
      }
      if (nameInput) nameInput.value = t.payerRecipient;
      if (descriptionInput) descriptionInput.value = t.description;
      if (valueInput) valueInput.value = t.value.toString().replace('.', ',');
      if (paymentInput) paymentInput.value = t.paymentMethod;
    }, 100);
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'church_transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: '',
          value: 0,
          type: 'saida',
          ...data,
          rawDate: data.date,
          // Maintain compatibility with existing code that might use 'desc' or 'shop'
          desc: data.payerRecipient || data.description || 'S/ Identificação',
          shop: data.paymentMethod || 'Pix',
        };
      });
      setListaTransacoes(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'church_transactions');
      setLoading(false);
    });

    // Load registered suppliers for dropdown
    const qSuppliers = query(
      collection(db, 'suppliers'),
      where('userId', '==', user.uid)
    );
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      // Get the correct name based on supplier type
      const names = docs.map(s => s.tipo === 'Jurídica' ? s.nomeFantasia || s.razaoSocial : s.nome).filter(Boolean);
      setFornecedores(names);
      
      // Armazena mapeamento de nome para saber os detalhes
      const map = docs.map(s => ({
        name: s.tipo === 'Jurídica' ? s.nomeFantasia || s.razaoSocial : s.nome,
        fornece: s.servicosProdutos || '',
        address: s.endereco || s.address || '',
        number: s.numero || s.number || '',
        doc: s.tipo === 'Jurídica' ? s.cnpj : s.cpf,
        neighborhood: s.bairro || s.neighborhood || '',
        city: s.cidade || s.city || '',
        state: s.estado || s.state || ''
      }));
      setFornecedoresMapeados(map);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    // Load registered members for dropdown
    const qMembers = query(
      collection(db, 'members'),
      where('userId', '==', user.uid)
    );
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const names = docs.map(m => m.nome || m.nomeCompleto || m.name).filter(Boolean);
      setMembrosCadastrados(names);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    return () => {
      unsubscribe();
      unsubSuppliers();
      unsubMembers();
    };
  }, [user]);

  useEffect(() => {
    const parts = activeMonth.split('-');
    if (parts.length === 2) {
      const [m] = parts;
      const ySuffix = selectedYear.toString().slice(-2);
      setActiveMonth(`${m}-${ySuffix}`);
    }
  }, [selectedYear]);

  const dynamicMonths = useMemo(() => {
    const monthNames = [
      { id: 'jan', label: 'JAN' }, { id: 'feb', label: 'FEV' }, { id: 'mar', label: 'MAR' },
      { id: 'apr', label: 'ABR' }, { id: 'may', label: 'MAI' }, { id: 'jun', label: 'JUN' },
      { id: 'jul', label: 'JUL' }, { id: 'aug', label: 'AGO' }, { id: 'sep', label: 'SET' },
      { id: 'oct', label: 'OUT' }, { id: 'nov', label: 'NOV' }, { id: 'dec', label: 'DEZ' }
    ];
    
    const ySuffix = selectedYear.toString().slice(-2);
    
    const individualMonths = monthNames.map((m, idx) => {
      const monthTrans = listaTransacoes.filter(t => {
        const [y, mm] = (t.rawDate || '').split('-');
        return y === selectedYear.toString() && parseInt(mm) === idx + 1;
      });
      
      const balance = monthTrans.reduce((acc, t) => {
        return acc + (t.type === 'entrada' ? t.value : -t.value);
      }, 0);

      const isCurrent = activeMonth === `${m.id}-${ySuffix}`;

      return {
        id: `${m.id}-${ySuffix}`,
        label: `${m.label} ${ySuffix}`,
        value: `R$ ${Math.abs(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        status: balance > 0 ? 'paid' : balance < 0 ? 'debt' : 'upcoming'
      };
    });

    const yearlyTrans = listaTransacoes.filter(t => {
      const [y] = (t.rawDate || '').split('-');
      return y === selectedYear.toString();
    });

    const yearlyBalance = yearlyTrans.reduce((acc, t) => {
      return acc + (t.type === 'entrada' ? t.value : -t.value);
    }, 0);

    const allYearItem = {
      id: `all-${ySuffix}`,
      label: 'ANO INTEIRO',
      value: `R$ ${Math.abs(yearlyBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      status: yearlyBalance > 0 ? 'paid' : yearlyBalance < 0 ? 'debt' : 'upcoming'
    };

    return [allYearItem, ...individualMonths];
  }, [listaTransacoes, selectedYear, activeMonth]);

  const filteredTransactionsByMonth = useMemo(() => {
    const [mLabel, ySuffix] = activeMonth.split('-');
    
    if (mLabel === 'all') {
      return listaTransacoes.filter(t => {
        const [y] = (t.rawDate || '').split('-');
        return y.endsWith(ySuffix);
      });
    }

    const monthsConv: any = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    const targetM = monthsConv[mLabel];
    
    return listaTransacoes.filter(t => {
      const [y, m] = (t.rawDate || '').split('-');
      return y.endsWith(ySuffix) && m === targetM;
    });
  }, [listaTransacoes, activeMonth]);

  const totalEntradas = filteredTransactionsByMonth
    .filter(t => t.type === 'entrada')
    .reduce((acc, curr) => acc + (curr.value || 0), 0);
  
  const totalSaidas = filteredTransactionsByMonth
    .filter(t => t.type === 'saida')
    .reduce((acc, curr) => acc + (curr.value || 0), 0);
  
  const displayTransactions = useMemo(() => {
    if (!searchTermCaixa.trim()) return filteredTransactionsByMonth;
    const lowerSearch = searchTermCaixa.toLowerCase();
    return filteredTransactionsByMonth.filter(t => 
      t.payerRecipient.toLowerCase().includes(lowerSearch) ||
      t.description.toLowerCase().includes(lowerSearch) ||
      t.operationNature?.toLowerCase().includes(lowerSearch) ||
      t.paymentMethod?.toLowerCase().includes(lowerSearch)
    );
  }, [filteredTransactionsByMonth, searchTermCaixa]);

  const displayTransactionsGrouped = useMemo(() => {
    const seenGroups = new Set();
    return displayTransactions.filter(t => {
      if (!t.groupId) return true;
      if (seenGroups.has(t.groupId)) return false;
      seenGroups.add(t.groupId);
      return true;
    });
  }, [displayTransactions]);

  const salvarRegistro = (nome: string, centro: string) => {
    // Sanitizar nome para remover sufixos de parcela e evitar duplicatas "sujas"
    const nomeBase = nome.replace(/\s+parcela\s*\d+/gi, '').trim();
    
    if (nomeBase && !historicoNomes.includes(nomeBase)) {
      const novoHistorico = [nomeBase, ...historicoNomes].slice(0, 50);
      setHistoricoNomes(novoHistorico);
      localStorage.setItem('church_records_names', JSON.stringify(novoHistorico));
    }

    if (centro && !historicoCentros.includes(centro)) {
      const novoHistorico = [centro, ...historicoCentros].slice(0, 20);
      setHistoricoCentros(novoHistorico);
      localStorage.setItem('church_records_centers', JSON.stringify(novoHistorico));
    }
  };

  const handleYearScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Infinitely add years on scroll
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setAvailableYears(prev => {
        const last = prev[prev.length - 1];
        if (prev.length > 50) return prev; // Limit to prevent performance issues
        return [...prev, last + 1];
      });
    }
    if (scrollTop <= 10) {
      setAvailableYears(prev => {
        const first = prev[0];
        if (prev.length > 50) return prev;
        return [first - 1, ...prev];
      });
    }
  };

  const displayData = useMemo(() => {
    // Basic cumulative calculation helper
    const getBalanceAtStartOf = (year: number, monthNum?: string) => {
      let balance = 0;
      listaTransacoes.forEach(t => {
        if (!t.rawDate || t.status === 'Cancelado') return;
        
        const val = Number(t.value) || 0;
        const [ty, tm] = t.rawDate.split('-');
        const tYear = parseInt(ty);
        const tMonth = parseInt(tm);
        
        const isBefore = monthNum 
          ? (tYear < year || (tYear === year && tMonth < parseInt(monthNum)))
          : (tYear < year);
          
        if (isBefore) {
          if (t.type === 'entrada') {
            if (t.status === 'Recebido') balance += val;
          } else {
            balance -= val;
          }
        }
      });
      return balance;
    };

    if (chartFilter === 'mensal') {
      const parts = (activeMonth || '').split('-');
      if (parts.length < 2) return [];
      const [filterMonth, filterYearSuffix] = parts;
      
      // If "Ano Inteiro" is selected, the "mensal" view doesn't make sense per-day 
      // of a non-existent month. We can either show an empty chart or all year data.
      // But usually chartFilter would be toggled to 'anual' by user.
      if (filterMonth === 'all') return [];

      const monthsConversion: any = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const targetMonthNum = monthsConversion[filterMonth];
      const targetYear = parseInt(`20${filterYearSuffix}`);

      let currentBalance = getBalanceAtStartOf(targetYear, targetMonthNum);
      
      const days = Array.from({ length: 31 }, (_, i) => {
        const dayStr = (i + 1).toString().padStart(2, '0');
        
        let dayNet = 0;
        listaTransacoes.forEach(t => {
          if (!t.rawDate || t.status === 'Cancelado') return;
          const [y, m, d] = t.rawDate.split('-');
          const val = Number(t.value) || 0;
          
          if (parseInt(y) === targetYear && m === targetMonthNum && d === dayStr) {
            if (t.type === 'entrada') {
              if (t.status === 'Recebido') dayNet += val;
            } else {
              dayNet -= val;
            }
          }
        });
        
        currentBalance += dayNet;
        
        // Calculate daily totals for entries and exits
        let entradaDia = 0;
        let saidaDia = 0;
        let aReceberDia = 0;
        let aPagarDia = 0;
        listaTransacoes.forEach(t => {
          if (!t.rawDate || t.status === 'Cancelado') return;
          const [y, m, d] = t.rawDate.split('-');
          const val = Number(t.value) || 0;
          if (parseInt(y) === targetYear && m === targetMonthNum && d === dayStr) {
            if (t.type === 'entrada') {
              if (t.status === 'Recebido') entradaDia += val;
              if (t.status === 'Pendente') aReceberDia += val;
            } else if (t.type === 'saida') {
              if (t.status === 'Pago') saidaDia += val;
              if (t.status === 'Pendente') aPagarDia += val;
            }
          }
        });

        return { 
          name: dayStr, 
          value: Number(currentBalance.toFixed(2)),
          entrada: Number(entradaDia.toFixed(2)),
          saida: Number(saidaDia.toFixed(2)),
          aReceber: Number(aReceberDia.toFixed(2)),
          aPagar: Number(aPagarDia.toFixed(2))
        };
      });
      
      return days;
    } else {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      let currentBalance = getBalanceAtStartOf(selectedYear);
      
      const annual = monthNames.map((name, i) => {
        const monthNum = (i + 1).toString().padStart(2, '0');
        let monthNet = 0;
        listaTransacoes.forEach(t => {
          if (!t.rawDate || t.status === 'Cancelado') return;
          const [y, m] = t.rawDate.split('-');
          const val = Number(t.value) || 0;
          
          if (parseInt(y) === selectedYear && m === monthNum) {
            if (t.type === 'entrada') {
              if (t.status === 'Recebido') monthNet += val;
            } else {
              monthNet -= val;
            }
          }
        });
        currentBalance += monthNet;
        
        // Calculate monthly totals for entries and exits
        let entradaMes = 0;
        let saidaMes = 0;
        let aReceberMes = 0;
        let aPagarMes = 0;
        listaTransacoes.forEach(t => {
          if (!t.rawDate || t.status === 'Cancelado') return;
          const [y, m] = t.rawDate.split('-');
          const val = Number(t.value) || 0;
          if (parseInt(y) === selectedYear && m === monthNum) {
            if (t.type === 'entrada') {
              if (t.status === 'Recebido') entradaMes += val;
              if (t.status === 'Pendente') aReceberMes += val;
            } else if (t.type === 'saida') {
              if (t.status === 'Pago') saidaMes += val;
              if (t.status === 'Pendente') aPagarMes += val;
            }
          }
        });

        return { 
          name, 
          value: Number(currentBalance.toFixed(2)),
          entrada: Number(entradaMes.toFixed(2)),
          saida: Number(saidaMes.toFixed(2)),
          aReceber: Number(aReceberMes.toFixed(2)),
          aPagar: Number(aPagarMes.toFixed(2))
        };
      });
      
      return annual;
    }
  }, [listaTransacoes, chartFilter, activeMonth, selectedYear]);

  // Dynamic calculations for summary cards based on active month
  const cardsData = useMemo(() => {
    const parts = (activeMonth || '').split('-');
    if (parts.length < 2) return [];
    
    const [mLabel, ySuffix] = parts;
    const isAll = mLabel === 'all';
    
    const monthsConv: any = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    
    const ptMonths: any = {
      'jan': 'JAN', 'feb': 'FEV', 'mar': 'MAR', 'apr': 'ABR', 'may': 'MAI', 'jun': 'JUN',
      'jul': 'JUL', 'aug': 'AGO', 'sep': 'SET', 'oct': 'OUT', 'nov': 'NOV', 'dec': 'DEZ'
    };
    
    const targetM = monthsConv[mLabel];
    const ptLabel = isAll ? 'ANO INTEIRO' : (ptMonths[mLabel] || mLabel.toUpperCase());
    
    const entries = listaTransacoes.filter(t => t.type === 'entrada');
    const exits = listaTransacoes.filter(t => t.type === 'saida');
    
    const entriesCurrentPeriod = entries.filter(t => {
      const [y, m] = (t.rawDate || '').split('-');
      const yearMatch = y.endsWith(ySuffix);
      if (isAll) return yearMatch;
      return yearMatch && m === targetM;
    });
    
    const exitsCurrentPeriod = exits.filter(t => {
      const [y, m] = (t.rawDate || '').split('-');
      const yearMatch = y.endsWith(ySuffix);
      if (isAll) return yearMatch;
      return yearMatch && m === targetM;
    });

    const totalExitsPaid = exitsCurrentPeriod.filter(t => t.status === 'Pago').reduce((acc, t) => acc + (Number(t.value) || 0), 0);
    const totalEntriesReceived = entriesCurrentPeriod.filter(t => t.status === 'Recebido').reduce((acc, t) => acc + (Number(t.value) || 0), 0);
    const netPeriod = totalEntriesReceived - totalExitsPaid;
    
    // Saldo Global Absoluto (Tudo o que aconteceu na história até hoje - Independente de Filtro)
    const absoluteGlobalBalance = entries.filter(t => t.status === 'Recebido').reduce((acc, t) => acc + (Number(t.value) || 0), 0) 
    - exits.filter(t => t.status !== 'Cancelado').reduce((acc, t) => acc + (Number(t.value) || 0), 0);

    // Saldo Consolidado até o Período Selecionado
    const entriesUpToPeriod = entries.filter(t => {
      if (!t.rawDate) return false;
      const [y, m] = t.rawDate.split('-');
      const year = parseInt(y);
      const month = parseInt(m);
      const targetYear = parseInt(`20${ySuffix}`);
      const targetMonth = isAll ? 12 : parseInt(targetM);
      
      return year < targetYear || (year === targetYear && month <= targetMonth);
    });
    
    const exitsUpToPeriod = exits.filter(t => {
      if (!t.rawDate) return false;
      const [y, m] = t.rawDate.split('-');
      const year = parseInt(y);
      const month = parseInt(m);
      const targetYear = parseInt(`20${ySuffix}`);
      const targetMonth = isAll ? 12 : parseInt(targetM);
      
      return year < targetYear || (year === targetYear && month <= targetMonth);
    });

    const balanceUpToPeriod = entriesUpToPeriod.filter(t => t.status === 'Recebido').reduce((acc, t) => acc + (Number(t.value) || 0), 0)
    - exitsUpToPeriod.filter(t => t.status !== 'Cancelado').reduce((acc, t) => acc + (Number(t.value) || 0), 0);

    const totalDizimos = entriesCurrentPeriod.filter(t => t.operationNature === 'Dízimos' && t.status === 'Recebido').reduce((acc, t) => acc + (Number(t.value) || 0), 0);
    const totalOfertas = entriesCurrentPeriod.filter(t => t.operationNature === 'Ofertas' && t.status === 'Recebido').reduce((acc, t) => acc + (Number(t.value) || 0), 0);
    const totalArrecadacao = totalDizimos + totalOfertas;

    const totalFixas = exitsCurrentPeriod.filter(t => t.operationNature === 'Contas Fixas' && t.status === 'Pago').reduce((acc, t) => acc + (Number(t.value) || 0), 0);

    return [
      { 
        label: 'SALDO ATUAL EM CAIXA', 
        value: `R$ ${(balanceUpToPeriod || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: isAll ? `Ano ${selectedYear}` : ptLabel, 
        hex: balanceUpToPeriod >= 0 ? '#1e1b4b' : '#f43f5e',
        raw: balanceUpToPeriod,
        totalGlobal: absoluteGlobalBalance || 0, 
        netMonth: netPeriod || 0
      },
      { 
        label: 'SALDO GLOBAL ACUMULADO', 
        value: `R$ ${(absoluteGlobalBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: 'TOTAL HISTÓRICO', 
        hex: absoluteGlobalBalance >= 0 ? '#1e1b4b' : '#f43f5e',
      },
      { 
        label: isAll ? `SUPERÁVIT ANUAL 20${ySuffix}` : 'SUPERÁVIT DO PERÍODO', 
        value: `R$ ${netPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: netPeriod >= 0 ? 'Positivo' : 'Déficit', 
        hex: netPeriod >= 0 ? '#10b981' : '#f43f5e',
        raw: netPeriod
      },
      { 
        label: `ARRECADAÇÃO (D+O)`, 
        value: `R$ ${totalArrecadacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: 'Entrada Efetiva', 
        hex: '#06b6d4' 
      },
      { 
        label: `CUSTO FIXO PAGO`, 
        value: `R$ ${totalFixas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: 'Manutenção', 
        hex: '#f43f5e' 
      },
      { 
        label: isAll ? `PENDÊNCIAS (ANO 20${ySuffix})` : `PENDÊNCIAS (${ptLabel})`, 
        value: `R$ ${exitsCurrentPeriod.filter(t => t.status === 'Pendente').reduce((acc, t) => acc + (Number(t.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: 'A Pagar', 
        hex: '#f59e0b' 
      },
      { 
        label: isAll ? `PREVISÃO (ANO 20${ySuffix})` : `PREVISÃO (${ptLabel})`, 
        value: `R$ ${entriesCurrentPeriod.filter(t => t.status === 'Pendente').reduce((acc, t) => acc + (Number(t.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
        change: 'A Receber', 
        hex: '#8b5cf6' 
      }
    ];
  }, [listaTransacoes, activeMonth, selectedYear]);

  const dynamicPieData = useMemo(() => {
    const exits = filteredTransactionsByMonth.filter(t => t.type === 'saida');
    const groups: any = {};
    
    exits.forEach(t => {
      const label = (t.costCenter || t.operationNature || 'DIVERSOS').toUpperCase();
      groups[label] = (groups[label] || 0) + Number(t.value);
    });

    const entries = Object.keys(groups).map((name, i) => ({
      name,
      value: groups[name],
      color: pieColors[i % pieColors.length]
    }));

    return entries.length > 0 ? entries : [{ name: 'S/ DADOS', value: 0, color: '#cbd5e1' }];
  }, [filteredTransactionsByMonth]);

  const dueWarnings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = listaTransacoes.filter(t => t.status === 'Pendente');
    
    const overdue = pending.filter(t => {
      if (!t.rawDate) return false;
      const tDate = new Date(t.rawDate + 'T00:00:00'); // ensuring local time
      return tDate < today;
    });

    const soon = pending.filter(t => {
      if (!t.rawDate) return false;
      const tDate = new Date(t.rawDate + 'T00:00:00');
      const diffTime = tDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });

    return {
      overdueCount: overdue.length,
      soonCount: soon.length,
      overdueValue: overdue.reduce((acc, t) => acc + t.value, 0),
      soonValue: soon.reduce((acc, t) => acc + t.value, 0)
    };
  }, [listaTransacoes]);

  return (
    <div className="h-full flex flex-col pt-4 overflow-hidden bg-[#f8faff] dark:bg-slate-950">
      {/* Tabs Header */}
      <div className="px-8 border-b border-slate-100 dark:border-slate-800/30 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm relative">
        <div className="flex gap-8 overflow-x-auto scrollbar-hide py-1">
          {[
            { id: 'geral', label: 'VISÃO GERAL', icon: LayoutDashboard },
            { id: 'transacoes', label: 'ENTRADAS / SAÍDAS', icon: ArrowRightLeft },
            { id: 'vencimentos', label: 'VENCIMENTOS', icon: Clock },
            { id: 'relatorios', label: 'RELATÓRIOS', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 text-xs font-bold transition-all relative ${
                activeTab === tab.id 
                  ? 'text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab" 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" 
                />
              )}
            </button>
          ))}
        </div>
        
        {/* Discret Action: Clear all data */}
        <div className="flex items-center opacity-30 hover:opacity-100 transition-opacity">
          <button 
            onClick={handleClearAllDatabase}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="Apagar todos os dados do caixa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 scrollbar-hide">
        {/* Month & Year Filter Area */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900/50 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex-1 flex gap-1 px-1 overflow-x-auto scrollbar-hide">
            {dynamicMonths.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setActiveMonth(m.id);
                  if (m.id.startsWith('all')) {
                    setChartFilter('anual');
                  } else {
                    setChartFilter('mensal');
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all gap-0.5 relative min-w-[70px] border-l-[3px] ${
                  activeMonth === m.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none border-indigo-400'
                    : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                style={{ 
                  borderLeftColor: activeMonth === m.id 
                    ? undefined 
                    : m.status === 'paid' ? '#10b981' : m.status === 'debt' ? '#f43f5e' : '#e2e8f0' 
                }}
              >
                <span className="text-[9px] font-black tracking-tighter uppercase whitespace-nowrap">
                  {m.id.startsWith('all') ? 'ANO INTEIRO' : m.label.split(' ')[0]}
                </span>
                <span className={`text-[10px] font-bold ${activeMonth === m.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {m.value}
                </span>
                {m.status === 'paid' && !(activeMonth === m.id) && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white dark:border-slate-900" />
                )}
                {m.status === 'debt' && !(activeMonth === m.id) && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-400 border border-white dark:border-slate-900" />
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
              className={`p-3 rounded-xl border border-slate-200 dark:border-slate-700 border-l-[3px] transition-all flex flex-col items-center gap-1 min-w-[70px] ${isYearPickerOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600 border-l-indigo-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-l-slate-300 dark:border-l-slate-600'}`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-[10px] font-black">{selectedYear}</span>
            </button>

            <AnimatePresence>
              {isYearPickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsYearPickerOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20 text-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecionar Ano</span>
                    </div>
                    <div 
                      className="max-h-[220px] overflow-y-auto scrollbar-hide py-1"
                      onScroll={handleYearScroll}
                    >
                      {availableYears.map(year => (
                        <button
                          key={year}
                          onClick={() => {
                            setSelectedYear(year);
                            setIsYearPickerOpen(false);
                          }}
                          className={`w-full py-2.5 px-4 text-xs font-bold transition-colors text-center ${
                            selectedYear === year 
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' 
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {activeTab === 'geral' ? (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 w-full scrollbar-hide">
              {cardsData.map((card, i) => (
                <div key={i} className={`min-w-[220px] sm:min-w-[0px] sm:flex-1 shrink-0 snap-start bg-white dark:bg-slate-900 p-4 rounded-xl border-l-[3px] shadow-sm flex flex-col justify-between h-[85px] transition-all hover:shadow-md cursor-default`} style={{ borderLeftColor: card.hex }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{card.label}</span>
                    <span 
                      className="text-[9px] font-black rounded-full px-1.5 py-0.5"
                      style={{ 
                        color: card.hex, 
                        backgroundColor: `${card.hex}15`
                      }}
                    >
                      {card.change}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">
                    {card.value}
                  </h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Side Column (Left Column) */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Due Warnings Widget */}
                {(dueWarnings.overdueCount > 0 || dueWarnings.soonCount > 0) && (
                  <div 
                    onClick={() => setActiveTab('vencimentos')}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border space-y-4 cursor-pointer hover:shadow-md transition-all ${
                      dueWarnings.overdueCount > 0 
                        ? 'border-rose-200 dark:border-rose-900/50' 
                        : 'border-amber-200 dark:border-amber-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-full ${dueWarnings.overdueCount > 0 ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600'}`}>
                        {dueWarnings.overdueCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {dueWarnings.overdueCount > 0 ? 'Contas Atrasadas!' : 'Vencimentos Próximos'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-500">Atenção aos pagamentos</p>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {dueWarnings.overdueCount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-rose-600">{dueWarnings.overdueCount} Vencido{dueWarnings.overdueCount > 1 ? 's' : ''}</span>
                          <span className="font-black text-rose-600">R$ {dueWarnings.overdueValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {dueWarnings.soonCount > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-amber-600">Vence em 7 dias ({dueWarnings.soonCount})</span>
                          <span className="font-black text-amber-600">R$ {dueWarnings.soonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Info Section */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Acumulativo (Global)</p>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        R$ {cardsData[0] ? ((cardsData[0] as any).totalGlobal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                      </h4>
                      <div className="mt-2 flex items-center gap-2">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Movimento do Mês:</span>
                         <span className={`text-xs font-black ${cardsData[0] && ((cardsData[0] as any).netMonth || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                           R$ {cardsData[0] ? ((cardsData[0] as any).netMonth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                         </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full mb-2 uppercase tracking-tighter">
                        {activeMonth.toUpperCase().replace('-', '/')}
                      </span>
                      <div className="flex items-center text-slate-400 font-bold text-[10px] gap-1">
                         <Clock className="w-3 h-3" /> Movimento
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Moeda</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">BRL / REAL</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                      <p className="text-xs font-bold text-amber-500 uppercase">Aberta</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button 
                      onClick={() => openNewModal('entrada')}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-[10px] uppercase tracking-widest"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span translate="no">Entrada</span>
                    </button>
                    <button 
                      onClick={() => openNewModal('saida')}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-[10px] uppercase tracking-widest"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span translate="no">Saída</span>
                    </button>
                    <button 
                      onClick={() => openNewModal('transferencia')}
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-[10px] uppercase tracking-widest"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span translate="no">Transferência</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Dashboard (Right Column) */}
              <div className="lg:col-span-9 space-y-8 flex flex-col">
                {/* Fluxo de Caixa Chart */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] relative w-full h-[400px] flex flex-col group overflow-hidden">
                  {/* Digital Decoration Elements */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                  
                  <div className="relative z-20 flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 underline decoration-indigo-500/50 decoration-4 underline-offset-4 uppercase tracking-tighter">Fluxo de Dinheiro</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Análise de Performance e Saldo</p>
                    </div>
                    <div className="flex bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                      <button 
                        onClick={() => setChartFilter('mensal')}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${chartFilter === 'mensal' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Mensal
                      </button>
                      <button 
                        onClick={() => setChartFilter('anual')}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${chartFilter === 'anual' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Anual
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative z-10 -ml-4">
                    <ResponsiveContainer width="100%" height="100%" key={chartFilter}>
                      <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorAReceber" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorAPagar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="shadow" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                            <feOffset dx="0" dy="6" result="offsetblur" />
                            <feComponentTransfer>
                              <feFuncA type="linear" slope="0.5" />
                            </feComponentTransfer>
                            <feMerge>
                              <feMergeNode />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <XAxis 
                          dataKey={chartFilter === 'mensal' ? 'day' : 'name'} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} 
                          dy={15}
                          interval={0}
                          padding={{ left: 25, right: 25 }}
                        />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ stroke: '#1e3a8a', strokeWidth: 1, opacity: 0.3 }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-100 dark:border-slate-800 p-4 rounded-3xl shadow-2xl scale-110 transition-transform">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Período {label}</p>
                                  <div className="space-y-1">
                                    {payload.map((entry: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between gap-8 py-1 first:pt-0 last:pb-0 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{entry.name}</span>
                                        </div>
                                        <span className={`text-[11px] font-black tabular-nums ${
                                          entry.name === 'Entrada' ? 'text-blue-900 dark:text-blue-200' : 
                                          entry.name === 'Saída' ? 'text-rose-500 dark:text-rose-400' :
                                          entry.name === 'A Receber' ? 'text-emerald-500' : 'text-amber-500'
                                        }`}>
                                          {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          name="Entrada"
                          type="monotone" 
                          dataKey="entrada" 
                          stroke="#1e3a8a" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorEntrada)" 
                          dot={false}
                          activeDot={{ r: 6, fill: '#1e3a8a', stroke: '#fff', strokeWidth: 2 }}
                          filter="url(#shadow)"
                          animationDuration={2000}
                        />
                        <Area 
                          name="Saída"
                          type="monotone" 
                          dataKey="saida" 
                          stroke="#f43f5e" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorSaida)" 
                          dot={false}
                          activeDot={{ r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                          filter="url(#shadow)"
                          animationDuration={2000}
                        />
                        <Area 
                          name="A Receber"
                          type="monotone" 
                          dataKey="aReceber" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          fillOpacity={1} 
                          fill="url(#colorAReceber)" 
                          dot={false}
                          activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                          animationDuration={2000}
                        />
                        <Area 
                          name="A Pagar"
                          type="monotone" 
                          dataKey="aPagar" 
                          stroke="#f59e0b" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          fillOpacity={1} 
                          fill="url(#colorAPagar)" 
                          dot={false}
                          activeDot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bottom Widgets */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Despesas Donut */}
                  <div className="md:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Saídas p/ Depto</h3>
                      <div className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 px-2 py-1 rounded border-none outline-none">
                        {dynamicMonths.find(m => m.id === activeMonth)?.label || 'PERÍODO'}
                      </div>
                    </div>
                    <div className="h-48 flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dynamicPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dynamicPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full border-8 border-indigo-100 dark:border-slate-800"></div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {dynamicPieData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">R$ {item.value.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                      <div className="h-px bg-slate-50 dark:bg-slate-800 w-full"></div>
                    </div>
                  </div>

                  {/* Histórico Segment */}
                  <div className="md:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Histórico</h3>
                      <button 
                        onClick={() => setActiveTab('transacoes')}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest transition-colors"
                      >
                        Ver Tudo
                      </button>
                    </div>
                    <div className="space-y-4 flex-1">
                      {loading ? (
                        <div className="h-full flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                      ) : (
                        filteredTransactionsByMonth.slice(0, 5).map((t) => (
                          <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-lg">
                                $
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{t.desc}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-bold text-slate-400">{t.date}</span>
                                  <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">{t.type === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-black ${t.type === 'entrada' ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {t.value.toFixed(2).replace('.', ',')}</p>
                              <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-1 group-hover:text-indigo-400 transition-colors">via {t.shop}</p>
                            </div>
                          </div>
                        ))
                      )}
                      {!loading && filteredTransactionsByMonth.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                          <Receipt className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-xs font-bold opacity-40">Nenhuma transação este mês</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'transacoes' ? (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/30 dark:bg-slate-800/20">
                <div className="flex items-center gap-6">
                  <h3 className="text-[15px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest underline decoration-indigo-500 decoration-2 underline-offset-4">Detalhamento Financeiro</h3>
                  <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar registros..."
                      value={searchTermCaixa}
                      onChange={(e) => setSearchTermCaixa(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-64 focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                   onClick={() => setActiveTab('geral')}
                   className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-black text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Voltar para Visão Geral
                  </button>
                  <button 
                   onClick={() => { setModalType('entrada'); setNumParcelas(1); setIsModalOpen(true); }}
                   className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Novo Lançamento
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/10">
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Pagamento</th>
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                      <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center">
                          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : (
                      displayTransactionsGrouped.map((t) => {
                        const isInstallment = t.installments > 1;
                        const isExpanded = t.groupId && expandedGroups.includes(t.groupId);

                        return (
                          <React.Fragment key={t.id}>
                            <tr 
                              className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group ${isInstallment ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (isInstallment && t.groupId) {
                                  setExpandedGroups(prev => 
                                    prev.includes(t.groupId) ? prev.filter(g => g !== t.groupId) : [...prev, t.groupId]
                                  );
                                }
                              }}
                            >
                              <td className="px-8 py-2.5 whitespace-nowrap text-[13px] font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                                <div className="flex items-center gap-2">
                                  {safeFormatDate(t.date)}
                                </div>
                              </td>
                              <td className="px-8 py-2.5">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{t.payerRecipient}</p>
                                </div>
                              </td>
                              <td className="px-8 py-2.5">
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  {t.description?.replace(/\s*\(\s*P\s*\d+\/\d+\s*\)/gi, '')} 
                                  {isInstallment && (
                                    <span className="ml-2 text-[10px] font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 px-1.5 py-0.5 rounded tracking-widest">
                                      {t.currentInstallment}/{t.installments}
                                    </span>
                                  )}
                                </p>
                              </td>
                              <td className="px-8 py-2.5 whitespace-nowrap">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg tracking-widest border ${
                                  t.type === 'entrada' 
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                                }`}>
                                  {t.operationNature?.toUpperCase() || (t.type === 'entrada' ? 'ENTRADA' : 'SAÍDA')}
                                </span>
                              </td>
                              <td className="px-8 py-2.5 whitespace-nowrap text-[11px] font-bold text-slate-500 uppercase tracking-tighter italic">{t.paymentMethod}</td>
                              <td className={`px-8 py-2.5 whitespace-nowrap text-right font-black text-[13px] ${
                                t.type === 'entrada' ? 'text-emerald-500' : 'text-rose-500'
                              }`}>
                                <div className="flex flex-col items-end justify-center">
                                  <span>{t.type === 'entrada' ? '+' : '-'} R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  {isInstallment && (
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                                      Total: R$ {(t.value * t.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-2.5 whitespace-nowrap text-center">
                                <div className="grid grid-cols-4 gap-2 w-[160px] mx-auto transition-opacity">
                                  <div className="flex justify-center">
                                    {t.paymentMethod === 'Carnê' ? (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); generateCarnePDF(t); }} 
                                        className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 hover:scale-110"
                                        title="Imprimir Carnê"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); generateReceiptPDF(t); }} 
                                        className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 hover:scale-110"
                                        title="Imprimir Recibo"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex justify-center">
                                    {t.status === 'Pendente' ? (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handlePayInstallment(t.id, t.type); }} 
                                        className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-500 transition-colors shadow-sm border border-emerald-100 dark:border-emerald-500/20"
                                        title={t.type === 'entrada' ? 'Marcar como Recebido' : 'Marcar como Pago'}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    ) : <div className="w-8 h-8" />}
                                  </div>
                                  <div className="flex justify-center">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 transition-colors opacity-60 group-hover:opacity-100">
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="flex justify-center">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t); }} className="p-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-lg text-rose-500 transition-colors opacity-60 group-hover:opacity-100">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && t.groupId && (
                              listaTransacoes
                                .filter(it => it.groupId === t.groupId && it.id !== t.id)
                                .sort((a, b) => a.currentInstallment - b.currentInstallment)
                                .map(subT => (
                                  <tr key={subT.id} className="bg-slate-50/30 dark:bg-slate-800/10 border-l-4 border-l-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-8 py-1.5 whitespace-nowrap text-[11px] font-bold text-slate-400 italic pl-12 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                      {safeFormatDate(subT.date)}
                                    </td>
                                    <td className="px-8 py-1.5">
                                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{subT.payerRecipient}</p>
                                    </td>
                                    <td className="px-8 py-1.5">
                                      <p className="text-[11px] font-medium text-slate-500">
                                        {subT.description?.replace(/\s*\(\s*P\s*\d+\/\d+\s*\)/gi, '')}
                                        <span className="ml-2 text-[9px] font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 px-1.5 py-0.5 rounded tracking-widest">
                                          {subT.currentInstallment}/{subT.installments}
                                        </span>
                                      </p>
                                    </td>
                                    <td className="px-8 py-1.5 whitespace-nowrap">
                                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg tracking-widest border ${
                                        subT.type === 'entrada' 
                                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                                          : 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                                      }`}>
                                        {subT.operationNature?.toUpperCase() || (subT.type === 'entrada' ? 'ENTRADA' : 'SAÍDA')}
                                      </span>
                                    </td>
                                    <td className="px-8 py-1.5 text-[11px] text-slate-400 font-medium italic">
                                      {subT.paymentMethod}
                                    </td>
                                    <td className={`px-8 py-1.5 whitespace-nowrap text-right font-bold text-[11px] ${
                                      subT.type === 'entrada' ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                      <div className="flex flex-col items-end">
                                        <span>R$ {subT.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                          Total: R$ {(subT.value * subT.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-1.5 text-center">
                                      <div className="grid grid-cols-4 gap-2 w-[160px] mx-auto transition-opacity">
                                        <div className="flex justify-center">
                                          {subT.paymentMethod === 'Carnê' ? (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); generateCarnePDF(subT); }} 
                                              className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 hover:scale-110"
                                              title="Imprimir Carnê"
                                            >
                                              <Printer className="w-3.5 h-3.5" />
                                            </button>
                                          ) : (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); generateReceiptPDF(subT); }} 
                                              className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 hover:scale-110"
                                              title="Imprimir Recibo"
                                            >
                                              <Printer className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex justify-center">
                                          {subT.status === 'Pendente' ? (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handlePayInstallment(subT.id, subT.type); }} 
                                              className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-500 transition-colors shadow-sm border border-emerald-100 dark:border-emerald-500/20"
                                              title={subT.type === 'entrada' ? 'Receber' : 'Pagar'}
                                            >
                                              <CheckCircle className="w-3.5 h-3.5" />
                                            </button>
                                          ) : <div className="w-8 h-8" />}
                                        </div>
                                        <div className="flex justify-center">
                                          <button onClick={() => handleEdit(subT)} className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-indigo-500 transition-colors opacity-60 group-hover:opacity-100">
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <div className="flex justify-center">
                                          <button onClick={() => handleDelete(subT)} className="p-1.5 bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-rose-500 transition-colors opacity-60 group-hover:opacity-100">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {listaTransacoes.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                  <Receipt className="w-16 h-16 mb-4 opacity-10" />
                  <p className="text-xs font-black uppercase tracking-widest opacity-30">Nenhum registro encontrado</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'vencimentos' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-500" />
                Contas Pendentes - Ano {selectedYear}
              </h2>
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                  Resumo Geral do Ano
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Favorecido / Histórico</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Nº Parcelas</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Forma Pagto</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right text-indigo-500">Valor Parcela</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Valor Total R$</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="">
                    {listaTransacoes
                      .filter(t => t.status === 'Pendente' && (t.rawDate || '').startsWith(selectedYear.toString()))
                      .filter((t, index, self) => {
                        if (!t.groupId) return true;
                        // Keep only the first occurrence of each groupId
                        return index === self.findIndex(it => it.groupId === t.groupId);
                      })
                      .sort((a, b) => {
                        if (!a.rawDate) return 1;
                        if (!b.rawDate) return -1;
                        return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
                      })
                      .map((t) => {
                        const isInstallment = t.installments > 1;
                        const isExpanded = t.groupId && expandedGroups.includes(t.groupId);
                        const tDate = new Date((t.rawDate || '') + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isOverdue = tDate < today;
                        const diffTime = tDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const isSoon = diffDays >= 0 && diffDays <= 7;
                        const totalValue = t.value * t.installments;

                        return (
                          <React.Fragment key={t.id}>
                            <tr 
                              className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group ${isInstallment ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (isInstallment && t.groupId) {
                                  setExpandedGroups(prev => 
                                    prev.includes(t.groupId) ? prev.filter(g => g !== t.groupId) : [...prev, t.groupId]
                                  );
                                }
                              }}
                            >
                              <td className="px-8 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-bold text-sm ${isOverdue ? 'text-rose-600' : isSoon ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {safeFormatDate(t.rawDate)}
                                  </span>
                                  {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                                </div>
                              </td>
                              <td className="px-8 py-3 whitespace-nowrap">
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                                  {t.type === 'saida' ? <ArrowUpRight className="w-3 h-3 text-rose-500" /> : <ArrowDownLeft className="w-3 h-3 text-emerald-500" />}
                                  {t.payerRecipient || 'S/ Identificação'}
                                </p>
                              </td>
                              <td className="px-8 py-3 whitespace-nowrap">
                                <p className="text-xs text-slate-500">
                                  {t.description?.replace(/\s*\(\s*P\s*\d+\/\d+\s*\)/gi, '') || t.operationNature || '-'}
                                </p>
                              </td>
                              <td className="px-8 py-3 text-center whitespace-nowrap">
                                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded ${isInstallment ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500' : 'text-slate-400'}`}>
                                  {isInstallment ? `${t.currentInstallment}/${t.installments}` : '1/1'}
                                </span>
                              </td>
                              <td className="px-8 py-3 text-center whitespace-nowrap">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-tighter">
                                  {t.paymentMethod || '-'}
                                </p>
                              </td>
                              <td className="px-8 py-3 text-right whitespace-nowrap">
                                <p className="font-bold text-sm text-indigo-500 tabular-nums">
                                  {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </td>
                              <td className="px-8 py-3 text-right whitespace-nowrap">
                                <p className={`font-black text-sm tabular-nums ${t.type === 'saida' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </td>
                              <td className="px-8 py-3 text-center whitespace-nowrap">
                                <div className="grid grid-cols-3 gap-2 w-[120px] mx-auto">
                                  <div className="flex justify-center">
                                    {t.paymentMethod === 'Carnê' ? (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); generateCarnePDF(t); }} 
                                        className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded text-indigo-500 hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                                        title="Imprimir Carnê"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); generateReceiptPDF(t); }} 
                                        className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded text-indigo-500 hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                                        title="Imprimir Recibo"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex justify-center">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handlePayInstallment(t.id, t.type); }}
                                      className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded text-emerald-500 hover:bg-emerald-100 transition-colors"
                                      title={t.type === 'entrada' ? 'Receber' : 'Pagar'}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="flex justify-center">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleEdit(t, true); }}
                                      className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded text-indigo-500 hover:bg-indigo-100 transition-colors"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && t.groupId && (
                              listaTransacoes
                                .filter(it => it.groupId === t.groupId && it.id !== t.id && it.status === 'Pendente')
                                .sort((a, b) => (new Date(a.rawDate || '').getTime()) - (new Date(b.rawDate || '').getTime()))
                                .map(subT => (
                                  <tr key={subT.id} className="bg-slate-50/30 dark:bg-slate-800/10">
                                    <td className="px-8 py-2 whitespace-nowrap pl-12 text-xs text-slate-400">
                                      {safeFormatDate(subT.rawDate)}
                                    </td>
                                    <td className="px-8 py-2 text-xs text-slate-400 italic whitespace-nowrap">
                                      - Repetição da parcela -
                                    </td>
                                    <td className="px-8 py-2 text-xs text-slate-500 whitespace-nowrap">
                                      {subT.description?.replace(/\s*\(\s*P\s*\d+\/\d+\s*\)/gi, '')}
                                    </td>
                                    <td className="px-8 py-2 text-center whitespace-nowrap">
                                      <span className="text-[10px] font-black text-indigo-400">
                                        {subT.currentInstallment}/{subT.installments}
                                      </span>
                                    </td>
                                    <td className="px-8 py-2 text-center text-xs text-slate-400 whitespace-nowrap">
                                      {subT.paymentMethod}
                                    </td>
                                    <td className="px-8 py-2 text-right whitespace-nowrap">
                                      <span className="text-xs font-bold text-indigo-400/70 tabular-nums">
                                        {subT.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="px-8 py-2 text-right whitespace-nowrap">
                                      <span className={`text-xs font-bold tabular-nums ${subT.type === 'entrada' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {(subT.value * subT.installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                      <td className="px-8 py-2 text-center whitespace-nowrap">
                                        <div className="grid grid-cols-3 gap-2 w-[120px] mx-auto">
                                          <div className="flex justify-center">
                                            {subT.paymentMethod === 'Carnê' ? (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); generateCarnePDF(subT); }} 
                                                className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded text-indigo-500 hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                                                title="Imprimir Carnê"
                                              >
                                                <Printer className="w-3.5 h-3.5" />
                                              </button>
                                            ) : (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); generateReceiptPDF(subT); }} 
                                                className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded text-indigo-500 hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                                                title="Imprimir Recibo"
                                              >
                                                <Printer className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                          <div className="flex justify-center">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handlePayInstallment(subT.id, subT.type); }}
                                            className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded text-emerald-500/70 hover:bg-emerald-100 transition-colors"
                                            title={subT.type === 'entrada' ? 'Receber' : 'Pagar'}
                                          >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                          <div className="w-8 flex justify-center" />
                                        </div>
                                      </td>
                                  </tr>
                                ))
                            )}
                          </React.Fragment>
                        );
                      })}
                    {!loading && listaTransacoes.filter(t => t.status === 'Pendente' && (t.rawDate || '').startsWith(selectedYear.toString())).length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p className="font-bold text-sm">Tudo em dia!</p>
                          <p className="text-xs opacity-70">Não há contas ou boletos pendentes para o ano de {selectedYear}.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'relatorios' ? (
          <div className="w-full max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header Área de Relatórios */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl">
                  <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">
                    Centro de Relatórios
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Transparência e Prestação de Contas</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800/50">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <select 
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="bg-transparent text-[10px] font-black text-slate-600 dark:text-slate-200 outline-none uppercase tracking-widest cursor-pointer"
                  >
                    <option value="all">ANO INTEIRO</option>
                    <option value="01">JANEIRO</option>
                    <option value="02">FEVEREIRO</option>
                    <option value="03">MARÇO</option>
                    <option value="04">ABRIL</option>
                    <option value="05">MAIO</option>
                    <option value="06">JUNHO</option>
                    <option value="07">JULHO</option>
                    <option value="08">AGOSTO</option>
                    <option value="09">SETEMBRO</option>
                    <option value="10">OUTUBRO</option>
                    <option value="11">NOVEMBRO</option>
                    <option value="12">DEZEMBRO</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800/50">
                  <select 
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="bg-transparent text-[10px] font-black text-slate-600 dark:text-slate-200 outline-none uppercase tracking-widest cursor-pointer"
                  >
                    {(availableYears || []).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(RELATORIOS || []).map((report) => (
                <button
                  key={report.id}
                  onClick={() => generatePDF(report.id)}
                  className="group relative flex items-start gap-5 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all hover:-translate-y-1 text-left"
                >
                  <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors`}>
                    <report.icon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">{report.title}</h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-4">{report.desc}</p>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                      <Download className="w-3.5 h-3.5" />
                      Gerar PDF / Imprimir
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Printer className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}

              <button
                onClick={() => setIsCoverModalOpen(true)}
                className="group relative flex items-start gap-5 p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/10 transition-all text-left"
              >
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                  <Receipt className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">Capas de Carnês</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-4">Gerencie e imprima as capas personalizadas para os carnês de campanhas.</p>
                  
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    <Settings className="w-3.5 h-3.5" />
                    Abrir Gerenciador de Capas
                  </div>
                </div>
                {coverQueue.length > 0 && (
                  <div className="absolute top-4 right-4 bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                    {coverQueue.length} Pendente{coverQueue.length > 1 ? 's' : ''}
                  </div>
                )}
              </button>
            </div>

            {/* Footer Informativo */}
            <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px]" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="max-w-md">
                  <h2 className="text-2xl font-black mb-3 uppercase tracking-tighter">Fidelidade e Transparência</h2>
                  <p className="text-indigo-100/80 text-xs font-bold leading-relaxed">
                    Estes relatórios são gerados em tempo real com base nos dados registrados no Livro Caixa. 
                    A transparência é a base de uma administração profética e íntegra.
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-2 opacity-60">Status do Caixa Global</div>
                  <div className="text-4xl font-black tabular-nums">
                    R$ {cardsData && cardsData[0] ? (cardsData[0] as any).totalGlobal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00' : '0,00'}
                  </div>
                  <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Saldo em Tempo Real
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[480px] bg-white dark:bg-slate-950 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              {/* Dynamic Header - Soft Tones */}
              <div className={`px-8 pt-8 pb-10 relative overflow-hidden transition-colors duration-500 ${
                modalType === 'entrada' ? 'bg-emerald-100 dark:bg-emerald-500/40' : 
                modalType === 'saida' ? 'bg-rose-100 dark:bg-rose-500/40' : 
                'bg-indigo-100 dark:bg-indigo-500/40'
              }`}>
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-7 rounded-md flex items-center justify-center shadow-lg transition-all duration-500 ${
                        modalType === 'entrada' ? 'bg-emerald-500' : 
                        modalType === 'saida' ? 'bg-rose-500' : 'bg-indigo-500'
                      }`}>
                        <div className="w-4 h-3 border border-white/20 rounded-sm" />
                      </div>
                      <div className="flex gap-0.5">
                        <div className={`w-0.5 h-3 rounded-full transition-colors ${
                          modalType === 'entrada' ? 'bg-emerald-400 opacity-70' : 
                          modalType === 'saida' ? 'bg-rose-400 opacity-70' : 'bg-indigo-400 opacity-70'
                        }`} />
                        <div className={`w-0.5 h-3 rounded-full transition-colors ${
                          modalType === 'entrada' ? 'bg-emerald-400 opacity-90' : 
                          modalType === 'saida' ? 'bg-rose-400 opacity-90' : 'bg-indigo-400 opacity-90'
                        }`} />
                        <div className={`w-0.5 h-3 rounded-full transition-colors ${
                          modalType === 'entrada' ? 'bg-emerald-400' : 
                          modalType === 'saida' ? 'bg-rose-400' : 'bg-indigo-400'
                        }`} />
                      </div>
                    </div>
                  </div>
                  
                  <h3 className={`text-3xl font-black tracking-tight mt-2 ${
                    modalType === 'entrada' ? 'text-emerald-900 dark:text-emerald-100' : 
                    modalType === 'saida' ? 'text-rose-900 dark:text-rose-100' : 
                    'text-indigo-900 dark:text-indigo-100'
                  }`}>
                    {modalType === 'entrada' ? 'Novo Recebimento' : 
                     modalType === 'saida' ? 'Novo Pagamento' : 
                     'Nova Transferência'}
                  </h3>
                </div>

                {/* Representative Corner Icon */}
                <div className="absolute top-6 right-6 opacity-30">
                  {modalType === 'entrada' ? (
                    <ArrowDownLeft className={`w-16 h-16 ${modalType === 'entrada' ? 'text-emerald-500' : ''}`} />
                  ) : modalType === 'saida' ? (
                    <ArrowUpRight className={`w-16 h-16 ${modalType === 'saida' ? 'text-rose-500' : ''}`} />
                  ) : (
                    <ArrowRightLeft className={`w-16 h-16 ${modalType === 'transferencia' ? 'text-cyan-500' : ''}`} />
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setConfirmStep('none');
                    setPendingData(null);
                  }}
                  className="absolute top-2 right-2 p-2 text-slate-400 hover:text-slate-600 transition-colors z-30"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Dynamic Glow */}
                <div className={`absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-50 pointer-events-none transition-all duration-700 ${
                  modalType === 'entrada' ? 'bg-emerald-500' : 
                  modalType === 'saida' ? 'bg-rose-500' : 'bg-cyan-500'
                }`} />
              </div>

              {/* Form Body */}
              <div className="px-8 pb-8 -mt-6 relative z-20">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-none p-5 space-y-5 border border-slate-200 dark:border-slate-800">
                  <AnimatePresence mode="wait">
                    {confirmStep === 'none' ? (
                      <motion.div 
                        key="form"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="grid grid-cols-2 gap-4"
                      >
                        {/* Data */}
                        <div className="col-span-1">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Data</label>
                          <input 
                            id="modal-date-input"
                            type="date" 
                            defaultValue={pendingData?.date || (editingId ? '' : new Date().toISOString().split('T')[0])}
                            onChange={(e) => {
                              const date = e.target.value;
                              const paymentInput = document.getElementById('modal-payment-input') as HTMLSelectElement;
                              if (paymentInput && paymentInput.value && !editingId) {
                                const newDate = adjustDateByBillingConfig(date, paymentInput.value);
                                if (newDate !== date) {
                                  e.target.value = newDate;
                                }
                              }
                            }}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>

                        {/* Nat. Operação */}
                        <div className="col-span-1">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Nat. Operação</label>
                          <select 
                            id="modal-nature-input"
                            value={modalNature}
                            onChange={(e) => setModalNature(e.target.value)}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                          >
                            {modalType === 'entrada' ? (
                              <>
                                <option>Dízimos</option>
                                <option>Ofertas</option>
                                <option>Doações</option>
                                <option>Campanha</option>
                                <option>Eventos</option>
                                <option>Missões</option>
                              </>
                            ) : modalType === 'saida' ? (
                              <>
                                <option>Manutenção</option>
                                <option>Contas Fixas</option>
                                <option>Ação Social</option>
                                <option>Eventos</option>
                                <option>Missões</option>
                                <option>Patrimônio</option>
                              </>
                            ) : (
                              <option>Transferência</option>
                            )}
                            <option>Outros</option>
                          </select>
                        </div>

                        {/* Centro de Custo */}
                        <div className="col-span-1">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Centro de Custo</label>
                          <input 
                            id="modal-center-input"
                            type="text"
                            list="recent-centers"
                            defaultValue={pendingData?.center || ''}
                            placeholder="Ex: Templo, Missões..."
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          />
                          <datalist id="recent-centers">
                            {historicoCentros.map(c => <option key={c} value={c} />)}
                          </datalist>
                        </div>

                        {/* Status */}
                        <div className="col-span-1">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Status</label>
                          <select 
                            id="modal-status-input"
                            defaultValue={pendingData?.status || ''}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                          >
                            <option>Recebido</option>
                            <option>Pago</option>
                            <option>Pendente</option>
                          </select>
                        </div>

                        {/* Nome (Membro / Contribuinte) */}
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Membro / Contribuinte</label>
                          <input 
                            id="modal-name-input"
                            type="text" 
                            list="recent-names"
                            defaultValue={pendingData?.name || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (modalType === 'saida') {
                                const matched = fornecedoresMapeados.find(f => f.name === val);
                                if (matched && matched.fornece) {
                                  const descInput = document.getElementById('modal-description-input') as HTMLInputElement;
                                  if (descInput && !descInput.value) {
                                    descInput.value = matched.fornece;
                                  }
                                }
                              }
                            }}
                            placeholder={modalType === 'entrada' ? 'Nome do membro ou doador...' : 'Nome do favorecido ou fornecedor...'}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          />
                          <datalist id="recent-names">
                            {Array.from(new Set(
                              modalNature === 'Campanha'
                                ? membrosCadastrados 
                                : [
                                    ...historicoNomes,
                                    ...(modalType === 'saida' ? fornecedores : membrosCadastrados)
                                  ]
                            )).map(n => <option key={n} value={n} />)}
                          </datalist>
                        </div>

                        {/* Descrição / Histórico */}
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Descrição / Histórico</label>
                          <input 
                            id="modal-description-input"
                            type="text"
                            defaultValue={pendingData?.description || ''}
                            placeholder="Detalhes adicionais do lançamento..."
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                          />
                        </div>

                        {/* Nome (Membro / Contribuinte) */}
                        <div className="col-span-1">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Valor R$</label>
                          <input 
                            id="modal-value-input"
                            type="text" 
                            placeholder="0,00"
                            defaultValue={pendingData?.valor || ''}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, "");
                              value = (Number(value) / 100).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              });
                              e.target.value = value;
                            }}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
                          />
                        </div>

                        {/* Nº de Parcelas */}
                        <div className="col-span-1">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Parcelamento</label>
                          <input 
                            type="number" 
                            value={numParcelas}
                            onChange={(e) => setNumParcelas(parseInt(e.target.value) || 1)}
                            min={1}
                            disabled={!!editingId}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                          />
                        </div>

                        {/* Forma de Pagamento */}
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Forma de Pagamento</label>
                          <select 
                            id="modal-payment-input"
                            defaultValue={pendingData?.payment || ''}
                            onChange={(e) => {
                              const method = e.target.value;
                              const dateInput = document.getElementById('modal-date-input') as HTMLInputElement;
                              if (dateInput && method && !editingId) {
                                const newDate = adjustDateByBillingConfig(dateInput.value, method);
                                if (newDate !== dateInput.value) {
                                  dateInput.value = newDate;
                                }
                              }
                            }}
                            className="w-full h-[26px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-4 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                          >
                            {numParcelas <= 1 && (
                              <>
                                <option>Dinheiro</option>
                                <option>Cartão Débito</option>
                                <option>Carteira</option>
                              </>
                            )}
                            <option>Pix</option>
                            <option>Carnê</option>
                            <option>Banco</option>
                            <option>Boleto</option>
                            <option>Cartão de Crédito</option>
                          </select>
                        </div>

                         <button 
                          onClick={() => {
                            const dateInput = (document.getElementById('modal-date-input') as HTMLInputElement)?.value;
                            const natureInput = (document.getElementById('modal-nature-input') as HTMLSelectElement)?.value;
                            const centerInput = (document.getElementById('modal-center-input') as HTMLInputElement)?.value;
                            const statusInput = (document.getElementById('modal-status-input') as HTMLSelectElement)?.value;
                            const nomeInput = (document.getElementById('modal-name-input') as HTMLInputElement)?.value;
                            const descriptionInput = (document.getElementById('modal-description-input') as HTMLInputElement)?.value;
                            const valorInput = (document.getElementById('modal-value-input') as HTMLInputElement)?.value;
                            const paymentInput = (document.getElementById('modal-payment-input') as HTMLSelectElement)?.value;

                            if (!dateInput || !nomeInput || !valorInput) {
                              showError('Preencha os campos obrigatórios (Data, Nome e Valor)!');
                              return;
                            }

                            setPendingData({
                              date: dateInput,
                              nature: natureInput,
                              center: centerInput,
                              status: statusInput,
                              name: nomeInput,
                              description: descriptionInput,
                              valor: valorInput,
                              payment: paymentInput
                            });
                            setConfirmStep('ask');
                          }}
                          className={`col-span-2 w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-all active:scale-[0.98] h-8 flex items-center justify-center`}
                        >
                          Confirmar Lançamento
                        </button>
                      </motion.div>
                    ) : confirmStep === 'ask' ? (
                      <motion.div 
                        key="ask"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className={`p-6 rounded-2xl border text-center space-y-6 transition-colors duration-200 ${
                          editingId 
                            ? "bg-blue-50/50 dark:bg-blue-500/5 border-blue-100/50 dark:border-blue-500/10" 
                            : "bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100/50 dark:border-emerald-500/10"
                        }`}
                      >
                        <div className="space-y-2">
                          <p className={`text-sm font-black uppercase tracking-widest ${
                            editingId ? "text-blue-500" : "text-emerald-500"
                          }`}>
                            {editingId && isEditingPayment && listaTransacoes.find(it => it.id === editingId)?.groupId 
                              ? 'Como deseja realizar a quitação?' 
                              : (isEditingPayment ? 'Confirmar Pagamento?' : 'Confirmar este lançamento?')}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase italic">Esta ação registrará os dados permanentemente no sistema.</p>
                        </div>

                        {editingId && isEditingPayment && listaTransacoes.find(it => it.id === editingId)?.groupId ? (
                          <div className="flex flex-col gap-3 max-w-[320px] mx-auto px-4">
                            <button 
                              onClick={async () => {
                                if (!user || !pendingData) return;
                                setIsBatchPayment(false);
                                // A execução do salvamento agora é centralizada ou repetida aqui com o parâmetro correto
                                await handleFinalSave(false);
                              }}
                              className="py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Quitar Apenas Esta
                            </button>
                            <button 
                              onClick={async () => {
                                if (!user || !pendingData) return;
                                setIsBatchPayment(true);
                                await handleFinalSave(true);
                              }}
                              className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              <TrendingUp className="w-4 h-4" />
                              Quitar Todas as Pendentes
                            </button>
                            <button 
                              onClick={() => setConfirmStep('none')}
                              className="py-3 mt-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                            >
                              Voltar
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 max-w-[300px] mx-auto">
                            <button 
                              onClick={() => handleFinalSave(false)}
                              className={`py-3 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 ${
                                editingId 
                                  ? "bg-blue-500 hover:bg-blue-600 shadow-blue-100 dark:shadow-none" 
                                  : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100 dark:shadow-none"
                              }`}
                            >
                              Sim, Confirmar
                            </button>
                            <button 
                              onClick={() => setConfirmStep('none')}
                              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95"
                            >
                              Não, Cancelar
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="success"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-12 text-center space-y-4"
                      >
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Plus className="w-8 h-8 text-emerald-500 rotate-45" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Lançamento Realizado!</h4>
                        <p className="text-xs font-bold text-slate-400">Os dados foram salvos com sucesso no sistema.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cover Management Modal */}
      <AnimatePresence>
        {isCoverModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCoverModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[600px] bg-white dark:bg-slate-950 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Gerenciador de Capas</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personalize as capas das campanhas</p>
                  </div>
                  <button onClick={() => setIsCoverModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Title and Background */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título da Campanha</label>
                      <input 
                        type="text"
                        value={coverConfig.campaignTitle}
                        onChange={(e) => setCoverConfig(prev => ({ ...prev, campaignTitle: e.target.value }))}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagem de Fundo</label>
                      <button 
                        onClick={() => coverBgInputRef.current?.click()}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1"
                      >
                        <Upload className="w-4 h-4 text-indigo-500" />
                        <span className="truncate">{coverConfig.bgImage ? 'Trocar Imagem' : 'Fundo da Capa'}</span>
                      </button>
                      <input 
                        type="file" 
                        ref={coverBgInputRef}
                        className="hidden" 
                        accept="image/*"
                        onChange={handleCoverBgUpload}
                      />
                    </div>
                  </div>

                  {/* Manual Add */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        ref={nameInputRef}
                        placeholder="Adicionar nome manualmente..."
                        value={manualName}
                        onChange={(e) => {
                          setManualName(e.target.value);
                          setShowNameDropdown(true);
                        }}
                        onFocus={() => setShowNameDropdown(true)}
                        onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (manualName.trim()) {
                              addToCoverQueue(manualName);
                              setManualName('');
                              setShowNameDropdown(false);
                            }
                          }
                        }}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      
                      <AnimatePresence>
                        {showNameDropdown && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-[200px] overflow-y-auto custom-scrollbar"
                          >
                            {[...new Set([...membrosCadastrados, ...historicoNomes, ...(fornecedores || [])])]
                              .filter(name => name.toLowerCase().includes(manualName.toLowerCase()))
                              .sort()
                              .slice(0, 100)
                              .map((name, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setManualName(name);
                                    setShowNameDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                                >
                                  {name}
                                </button>
                              ))}
                            {manualName && ![...membrosCadastrados, ...historicoNomes, ...(fornecedores || [])].some(n => n.toLowerCase() === manualName.toLowerCase()) && (
                              <div className="px-4 py-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest italic">
                                Novo nome detectado
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button 
                      onClick={() => {
                        if (manualName.trim()) {
                          addToCoverQueue(manualName);
                          setManualName('');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all flex items-center gap-2 text-xs font-black"
                    >
                      <Plus className="w-4 h-4" />
                      ADD
                    </button>
                  </div>

                  {/* Queue List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fila de Impressão ({coverQueue.length})</label>
                      {coverQueue.length > 0 && (
                        <button 
                          onClick={() => setCoverQueue([])}
                          className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                        >
                          Limpar Tudo
                        </button>
                      )}
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {coverQueue.length === 0 ? (
                        <div className="py-8 text-center text-slate-300 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Nenhum nome na fila</p>
                        </div>
                      ) : (
                        coverQueue.map((name, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl group">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{name}</span>
                            <button 
                              onClick={() => setCoverQueue(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={generateCoversPDF}
                    disabled={coverQueue.length === 0}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Imprimir Todas as Capas ({coverQueue.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
