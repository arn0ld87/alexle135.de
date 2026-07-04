export class CommandHistory {
  private history: string[] = [];
  private currentIndex: number = -1;
  private tempCommand: string = '';

  constructor(initialHistory: string[] = []) {
    this.history = initialHistory;
  }

  add(command: string) {
    if (command.trim() && command !== this.history[this.history.length - 1]) {
      this.history.push(command);
    }
    this.currentIndex = this.history.length;
    this.tempCommand = '';
  }

  previous(currentInput: string): string | null {
    if (this.currentIndex === this.history.length) {
      this.tempCommand = currentInput;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  next(): string | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    } else if (this.currentIndex === this.history.length - 1) {
      this.currentIndex++;
      return this.tempCommand;
    } else if (this.currentIndex === this.history.length) {
      // Already at end, return tempCommand without incrementing
      return this.tempCommand || '';
    }
    return null;
  }

  getAll(): string[] {
    return [...this.history];
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.tempCommand = '';
  }
}
