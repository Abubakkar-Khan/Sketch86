export type ExampleProgram = {
  id: string;
  title: string;
  difficulty: "Beginner" | "Classwork" | "Explorer";
  concepts: string[];
  explanation: string;
  source: string;
};

export const examples: ExampleProgram[] = [
  {
    id: "move-registers",
    title: "Move values into registers",
    difficulty: "Beginner",
    concepts: ["MOV", "registers", "immediates"],
    explanation: "Introduces immediate values and register writes.",
    source: `ORG 100h
MOV AX, 5
MOV BX, 3
HLT`
  },
  {
    id: "add-two",
    title: "Add two numbers",
    difficulty: "Beginner",
    concepts: ["ADD", "flags", "registers"],
    explanation: "Adds BX into AX and updates arithmetic flags.",
    source: `ORG 100h
MOV AX, 5
MOV BX, 3
ADD AX, BX
HLT`
  },
  {
    id: "subtract-two",
    title: "Subtract two numbers",
    difficulty: "Beginner",
    concepts: ["SUB", "ZF", "CF"],
    explanation: "Subtracts a value and shows how flags change.",
    source: `ORG 100h
MOV AX, 9
SUB AX, 4
HLT`
  },
  {
    id: "compare",
    title: "Compare values",
    difficulty: "Beginner",
    concepts: ["CMP", "ZF", "conditional logic"],
    explanation: "Compares values without storing the subtraction result.",
    source: `ORG 100h
MOV AX, 7
MOV BX, 7
CMP AX, BX
HLT`
  },
  {
    id: "conditional-jump",
    title: "Conditional jump",
    difficulty: "Beginner",
    concepts: ["CMP", "JE", "labels"],
    explanation: "Jumps to a label when ZF is set.",
    source: `ORG 100h
MOV AX, 4
CMP AX, 4
JE equal
MOV BX, 0
HLT
equal:
MOV BX, 1
HLT`
  },
  {
    id: "cx-loop",
    title: "Loop with CX",
    difficulty: "Beginner",
    concepts: ["LOOP", "CX", "labels"],
    explanation: "Uses CX as the loop counter.",
    source: `ORG 100h
MOV CX, 4
MOV AX, 0
again:
INC AX
LOOP again
HLT`
  },
  {
    id: "stack",
    title: "Stack push/pop",
    difficulty: "Beginner",
    concepts: ["PUSH", "POP", "SS:SP"],
    explanation: "Shows the stack growing downward in memory.",
    source: `ORG 100h
MOV AX, 1234h
PUSH AX
MOV AX, 0
POP BX
HLT`
  },
  {
    id: "procedure",
    title: "Procedure with CALL and RET",
    difficulty: "Explorer",
    concepts: ["CALL", "RET", "procedure"],
    explanation: "CALL stores a return address on the stack, then RET restores it.",
    source: `ORG 100h
MOV AX, 1
CALL add_more
HLT
add_more PROC
ADD AX, 4
RET
add_more ENDP`
  },
  {
    id: "array-sum",
    title: "Array sum",
    difficulty: "Classwork",
    concepts: ["DW", "arr[si]", "LOOP", "DIV", "INT 21h"],
    explanation: "Sums a word array and prints the decimal result.",
    source: `.model small
.stack 100h
.data
arr dw 5, 10, 15, 20, 25
size dw 5
sum dw ?
msg db "The sum of the array [5, 10, 15, 20, 25] is: $"
.code
main:
MOV ax, @data
MOV ds, ax
LEA dx, msg
MOV ah, 9h
INT 21h
CALL sum_array
CALL display_int
MOV ah, 4Ch
INT 21h
sum_array PROC
MOV cx, size
MOV si, 0
MOV ax, 0
Add_loop:
ADD ax, arr[si]
ADD si, 2
LOOP Add_loop
MOV sum, ax
RET
sum_array ENDP
display_int PROC
MOV ax, sum
MOV bl, 10
DIV bl
MOV bh, ah
CMP al, 0
JE SINGLE
MOV dl, al
ADD dl, 48
MOV ah, 2h
INT 21h
SINGLE:
MOV dl, bh
ADD dl, 30h
MOV ah, 2h
INT 21h
RET
display_int ENDP
END main`
  },
  {
    id: "find-max",
    title: "Find maximum value",
    difficulty: "Classwork",
    concepts: ["arrays", "CMP", "JGE", "LOOP"],
    explanation: "Scans a word array and keeps the largest value in AX.",
    source: `.data
nums dw 8, 3, 12, 5
count dw 4
max dw ?
.code
MOV CX, count
MOV SI, 0
MOV AX, nums[SI]
ADD SI, 2
DEC CX
scan:
CMP AX, nums[SI]
JGE keep
MOV AX, nums[SI]
keep:
ADD SI, 2
LOOP scan
MOV max, AX
HLT`
  },
  {
    id: "print-char",
    title: "Print a character using INT 21h AH=02h",
    difficulty: "Beginner",
    concepts: ["INT 21h", "AH=02h", "DL"],
    explanation: "Prints the character stored in DL.",
    source: `ORG 100h
MOV DL, 'A'
MOV AH, 02h
INT 21h
HLT`
  },
  {
    id: "print-string",
    title: "Print string using INT 21h AH=09h",
    difficulty: "Beginner",
    concepts: ["DB", "LEA", "INT 21h"],
    explanation: "Prints a $-terminated string from DS:DX.",
    source: `.data
msg db 'Hello from Sketch86$', 0
.code
LEA DX, msg
MOV AH, 09h
INT 21h
HLT`
  },
  {
    id: "memory-vars",
    title: "Use memory variables",
    difficulty: "Beginner",
    concepts: ["DB", "DW", "variables"],
    explanation: "Reads and writes named data values.",
    source: `.data
score db 42
total dw ?
.code
MOV AL, score
ADD AL, 1
MOV total, AX
HLT`
  },
  {
    id: "flags-demo",
    title: "Demonstrate flags",
    difficulty: "Beginner",
    concepts: ["ZF", "CF", "SF", "OF", "PF", "AF"],
    explanation: "Subtracts equal values to turn on ZF.",
    source: `ORG 100h
MOV AX, 1
SUB AX, 1
HLT`
  },
  {
    id: "high-low",
    title: "Demonstrate high/low registers",
    difficulty: "Beginner",
    concepts: ["AX", "AH", "AL"],
    explanation: "Shows how AH and AL map onto AX.",
    source: `ORG 100h
MOV AX, 1234h
MOV AL, 56h
MOV AH, 78h
HLT`
  }
];
