import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotesService, Note, NoteVersion } from './services/notes';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  providers: [DatePipe]
})
export class AppComponent implements OnInit {
  currentView = 'editor'; 
  selectedNote = signal<Note | null>(null);
  noteTitle = '';
  isSaving = signal<boolean>(false);
  isDarkMode = signal<boolean>(false);
  draggedIndex: number | null = null;

  // ESTADOS DINÁMICOS PARA MODALES
  showHistoryModal = signal<boolean>(false);
  showShareModal = signal<boolean>(false); // <-- Nuevo estado para el modal de compartir
  linkCopied = signal<boolean>(false);     // <-- Controla la animación del feedback de copiado

  private autoSaveSubject = new Subject<void>();

  constructor(public notesService: NotesService) {
    this.autoSaveSubject.pipe(debounceTime(1000)).subscribe(() => {
      this.executeSave();
    });
  }

  ngOnInit(): void {
    this.notesService.fetchNotes();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.toggleDarkMode();
    }
  }

  toggleDarkMode() {
    this.isDarkMode.update(v => !v);
    if (this.isDarkMode()) {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }

  selectNote(note: Note) {
    this.selectedNote.set(note);
    this.noteTitle = note.titulo;
    const editor = document.getElementById('wysiwyg-editor');
    if (editor) {
      editor.innerHTML = note.contenido;
    }
  }

  startNewNote() {
    this.selectedNote.set(null);
    this.noteTitle = '';
    const editor = document.getElementById('wysiwyg-editor');
    if (editor) editor.innerHTML = '';
  }

  onInputChange() {
    this.isSaving.set(true);
    this.autoSaveSubject.next();
  }

  private executeSave() {
    const editor = document.getElementById('wysiwyg-editor');
    const htmlContent = editor ? editor.innerHTML : '';
    const currentNote = this.selectedNote();

    if (!this.noteTitle.trim() && !htmlContent.trim()) {
      this.isSaving.set(false);
      return;
    }

    const isoDateStr = new Date().toISOString();
    let updatedHistory: NoteVersion[] = currentNote?.historial ? [...currentNote.historial] : [];

    if (currentNote && currentNote.contenido !== htmlContent) {
      updatedHistory.unshift({
        fecha: isoDateStr,
        titulo: currentNote.titulo || 'Sin título',
        contenido: currentNote.contenido
      });
      if (updatedHistory.length > 10) updatedHistory.pop();
    }

    if (currentNote && currentNote.id) {
      const noteData: Omit<Note, 'id'> = {
        titulo: this.noteTitle.trim() || 'Documento sin título',
        contenido: htmlContent,
        fechaCreacion: currentNote.fechaCreacion,
        fechaActualizacion: isoDateStr,
        categoria: currentNote.categoria || '',
        compartida: currentNote.compartida || false,
        historial: updatedHistory
      };

      this.notesService.updateNote(currentNote.id, noteData).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.selectedNote.set({ id: currentNote.id, ...noteData });
          this.notesService.fetchNotes();
        },
        error: () => this.isSaving.set(false)
      });
    } else {
      const noteData: Omit<Note, 'id'> = {
        titulo: this.noteTitle.trim() || 'Documento sin título',
        contenido: htmlContent,
        fechaCreacion: isoDateStr,
        fechaActualizacion: isoDateStr,
        categoria: '',
        compartida: false,
        historial: []
      };

      this.notesService.createNote(noteData).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.selectedNote.set({ id: res.name, ...noteData });
          this.notesService.fetchNotes();
        },
        error: () => this.isSaving.set(false)
      });
    }
  }

  async downloadFile() {
    const editor = document.getElementById('wysiwyg-editor');
    const htmlContent = editor ? editor.innerHTML : '';
    
    if (!htmlContent.trim() && !this.noteTitle.trim()) {
      alert('No hay contenido ni título para guardar.');
      return;
    }

    const suggestedName = `${this.noteTitle.trim() || 'nota-online'}.doc`;
    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${this.noteTitle}</title></head>
      <body>${htmlContent}</body>
      </html>
    `;

    if ('showSaveFilePicker' in window) {
      try {
        const options = {
          suggestedName: suggestedName,
          types: [{
            description: 'Documento de Microsoft Word',
            accept: { 'application/msword': ['.doc'] }
          }]
        };
        const handle = await (window as any).showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(wordContent);
        await writable.close();
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err);
      }
    } else {
      const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  }

  copyToClipboard() {
    const editor = document.getElementById('wysiwyg-editor');
    if (!editor || (!editor.innerText.trim() && !editor.innerHTML.trim())) {
      alert('El lienzo está vacío. No hay nada que copiar.');
      return;
    }

    const textToCopy = editor.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      alert('¡Copiado! Todo el contenido del lienzo se guardó en el portapapeles.');
    }).catch(err => {
      console.error(err);
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Contenido copiado al portapapeles.');
    });
  }

  viewHistory() {
    const current = this.selectedNote();
    if (!current || !current.historial || current.historial.length === 0) {
      alert('No hay versiones anteriores registradas para esta nota.');
      return;
    }
    this.showHistoryModal.set(true);
  }

  restoreVersion(version: NoteVersion) {
    this.noteTitle = version.titulo;
    const editor = document.getElementById('wysiwyg-editor');
    if (editor) {
      editor.innerHTML = version.contenido;
    }
    this.onInputChange();
    this.showHistoryModal.set(false);
  }

  // MODIFICADO: Abre el nuevo panel modal dinámico de compartir nota
  shareNote() {
    const current = this.selectedNote();
    if (!current || !current.id) {
      alert('Por favor, escribe algo y espera a que la nota se sincronice en la nube antes de compartirla.');
      return;
    }
    
    // Si no estaba marcada como compartida, la activamos automáticamente
    if (!current.compartida) {
      current.compartida = true;
      this.onInputChange();
    }
    
    this.linkCopied.set(false);
    this.showShareModal.set(true);
  }

  // EXTRA DINÁMICO: Obtiene la URL pública del documento para la interfaz
  getShareUrl(): string {
    const current = this.selectedNote();
    return current ? `${window.location.origin}/share/${current.id}` : '';
  }

  // EXTRA DINÁMICO: Copia la URL del modal y activa el feedback visual controlado
  copyShareLink() {
    const url = this.getShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied.set(true);
      // Revierte el icono de check después de 2.5 segundos
      setTimeout(() => this.linkCopied.set(false), 2500);
    });
  }

  // EXTRA DINÁMICO: Permite revocar el acceso compartido desde el propio modal
  toggleSharePrivacy(event: Event) {
    const current = this.selectedNote();
    if (current) {
      current.compartida = (event.target as HTMLInputElement).checked;
      this.onInputChange();
    }
  }

  assignCategory() {
    const current = this.selectedNote();
    if (!current) return alert('Por favor, selecciona una nota primero.');
    const newCat = prompt('Introduce la categoría o etiqueta:', current.categoria || '');
    if (newCat !== null) {
      current.categoria = newCat.trim();
      this.onInputChange();
    }
  }

  exportToPDF() {
    const editor = document.getElementById('wysiwyg-editor');
    if (!editor || !editor.innerHTML.trim()) return alert('No hay contenido para exportar.');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${this.noteTitle || 'Nota'}</title>
            <style>body { font-family: sans-serif; padding: 40px; line-height: 1.6; } h1 { border-bottom: 2px solid #0ea5e9; }</style>
          </head>
          <body><h1>${this.noteTitle || 'Sin título'}</h1><div>${editor.innerHTML}</div></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  applyMarkdown() {
    const editor = document.getElementById('wysiwyg-editor');
    if (!editor) return;
    let text = editor.innerHTML;
    text = text.replace(/#\s(.*?)($|<br>)/g, '<h1>$1</h1>')
               .replace(/##\s(.*?)($|<br>)/g, '<h2>$1</h2>')
               .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>');
    editor.innerHTML = text;
    this.onInputChange();
  }

  onDragStart(index: number) { this.draggedIndex = index; }
  onDragOver(event: DragEvent) { event.preventDefault(); }
  onDrop(targetIndex: number) {
    if (this.draggedIndex === null || this.draggedIndex === targetIndex) return;
    const list = [...this.notesService.notes()];
    const draggedItem = list.splice(this.draggedIndex, 1)[0];
    list.splice(targetIndex, 0, draggedItem);
    this.notesService.notes.set(list);
    this.draggedIndex = null;
  }

  confirmDelete(id: string | undefined, event: Event) {
    event.stopPropagation();
    if (!id) return;
    if (confirm('¿Deseas eliminar permanentemente esta nota?')) {
      this.notesService.deleteNote(id).subscribe({
        next: () => {
          if (this.selectedNote()?.id === id) this.startNewNote();
          this.notesService.fetchNotes();
        }
      });
    }
  }

  formatText(command: string, value: string = '') {
    document.execCommand(command, false, value);
    this.onInputChange();
  }

  changeFont(event: Event) { this.formatText('fontName', (event.target as HTMLSelectElement).value); }
  changeSize(event: Event) { this.formatText('fontSize', (event.target as HTMLSelectElement).value); }
}