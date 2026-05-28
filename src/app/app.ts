import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotesService, Note } from './services/notes';
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
  
  private autoSaveSubject = new Subject<void>();

  constructor(public notesService: NotesService) {
    this.autoSaveSubject.pipe(debounceTime(800)).subscribe(() => {
      this.executeSave();
    });
  }

  ngOnInit(): void {
    this.notesService.fetchNotes();
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

    if (currentNote && currentNote.id) {
      const noteData: Omit<Note, 'id'> = {
        titulo: this.noteTitle.trim() || 'Documento sin título',
        contenido: htmlContent,
        fechaCreacion: currentNote.fechaCreacion,
        fechaActualizacion: isoDateStr
      };

      this.notesService.updateNote(currentNote.id, noteData).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.notesService.fetchNotes();
        },
        error: () => this.isSaving.set(false)
      });
    } else {
      const noteData: Omit<Note, 'id'> = {
        titulo: this.noteTitle.trim() || 'Documento sin título',
        contenido: htmlContent,
        fechaCreacion: isoDateStr,
        fechaActualizacion: isoDateStr
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

  confirmDelete(id: string | undefined, event: Event) {
    event.stopPropagation();
    if (!id) return;

    if (confirm('¿Estás seguro de que deseas eliminar permanentemente esta nota?')) {
      this.notesService.deleteNote(id).subscribe({
        next: () => {
          if (this.selectedNote()?.id === id) {
            this.startNewNote();
          }
          this.notesService.fetchNotes();
        }
      });
    }
  }

  formatText(command: string, value: string = '') {
    document.execCommand(command, false, value);
    this.onInputChange();
  }

  changeFont(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.formatText('fontName', select.value);
  }

  changeSize(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.formatText('fontSize', select.value);
  }
}