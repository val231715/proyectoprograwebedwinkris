import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface Note {
  id?: string;
  titulo: string;
  contenido: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  // ⚠️ Asegúrate de colocar la URL correcta de tu Firebase Realtime Database aquí:
  private baseUrl = 'https://proyectoprograweb-19bf1-default-rtdb.firebaseio.com/notas';

  public notes = signal<Note[]>([]);
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  fetchNotes(): void {
    this.isLoading.set(true);
    this.http.get<{ [key: string]: Omit<Note, 'id'> }>(`${this.baseUrl}.json`)
      .pipe(
        map(responseData => {
          const notesArray: Note[] = [];
          for (const key in responseData) {
            if (responseData.hasOwnProperty(key)) {
              notesArray.push({ id: key, ...responseData[key] });
            }
          }
          return notesArray.sort((a, b) => new Date(b.fechaActualizacion).getTime() - new Date(a.fechaActualizacion).getTime());
        })
      )
      .subscribe({
        next: (transformedNotes) => {
          this.notes.set(transformedNotes);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error en Firebase REST API:', err);
          alert('Error al conectar con la base de datos de Firebase.');
          this.isLoading.set(false);
        }
      });
  }

  createNote(note: Omit<Note, 'id'>): Observable<{ name: string }> {
    return this.http.post<{ name: string }>(`${this.baseUrl}.json`, note);
  }

  updateNote(id: string, note: Omit<Note, 'id'>): Observable<Note> {
    return this.http.put<Note>(`${this.baseUrl}/${id}.json`, note);
  }

  deleteNote(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}.json`);
  }
}