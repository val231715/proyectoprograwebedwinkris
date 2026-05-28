import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Notepad } from './notepad';

describe('Notepad', () => {
  let component: Notepad;
  let fixture: ComponentFixture<Notepad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notepad],
    }).compileComponents();

    fixture = TestBed.createComponent(Notepad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
