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
    source: `.model small
.stack 100h

.data
    first  dw 5
    second dw 3

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, first
    MOV bx, second
    HLT

END main`
  },
  {
    id: "add-two",
    title: "Add two numbers",
    difficulty: "Beginner",
    concepts: ["ADD", "flags", "registers"],
    explanation: "Adds BX into AX and updates arithmetic flags.",
    source: `.model small
.stack 100h

.data
    first  dw 5
    second dw 3
    result dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, first
    MOV bx, second
    ADD ax, bx
    MOV result, ax
    HLT

END main`
  },
  {
    id: "subtract-two",
    title: "Subtract two numbers",
    difficulty: "Beginner",
    concepts: ["SUB", "ZF", "CF"],
    explanation: "Subtracts a value and shows how flags change.",
    source: `.model small
.stack 100h

.data
    startValue dw 9
    minusValue dw 4
    difference dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, startValue
    SUB ax, minusValue
    MOV difference, ax
    HLT

END main`
  },
  {
    id: "compare",
    title: "Compare values",
    difficulty: "Beginner",
    concepts: ["CMP", "ZF", "conditional logic"],
    explanation: "Compares values without storing the subtraction result.",
    source: `.model small
.stack 100h

.data
    leftValue  dw 7
    rightValue dw 7

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, leftValue
    MOV bx, rightValue
    CMP ax, bx
    HLT

END main`
  },
  {
    id: "conditional-jump",
    title: "Conditional jump",
    difficulty: "Beginner",
    concepts: ["CMP", "JE", "labels"],
    explanation: "Jumps to a label when ZF is set.",
    source: `.model small
.stack 100h

.data
    value   dw 4
    matched dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, value
    CMP ax, 4
    JE equal
    MOV bx, 0
    MOV matched, bx
    HLT

equal:
    MOV bx, 1
    MOV matched, bx
    HLT

END main`
  },
  {
    id: "cx-loop",
    title: "Loop with CX",
    difficulty: "Beginner",
    concepts: ["LOOP", "CX", "labels"],
    explanation: "Uses CX as the loop counter.",
    source: `.model small
.stack 100h

.data
    count dw 4
    total dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV cx, count
    MOV ax, 0

again:
    INC ax
    LOOP again
    MOV total, ax
    HLT

END main`
  },
  {
    id: "stack",
    title: "Stack push/pop",
    difficulty: "Beginner",
    concepts: ["PUSH", "POP", "SS:SP"],
    explanation: "Shows the stack growing downward in memory.",
    source: `.model small
.stack 100h

.data
    value  dw 1234h
    copied dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, value
    PUSH ax
    MOV ax, 0
    POP bx
    MOV copied, bx
    HLT

END main`
  },
  {
    id: "procedure",
    title: "Procedure with CALL and RET",
    difficulty: "Explorer",
    concepts: ["CALL", "RET", "procedure"],
    explanation: "CALL stores a return address on the stack, then RET restores it.",
    source: `.model small
.stack 100h

.data
    value dw 1

.code
main:
    MOV ax, @data
    MOV ds, ax
    MOV ax, value
    CALL add_more
    MOV value, ax
    HLT

add_more PROC
    ADD ax, 4
    RET
add_more ENDP

END main`
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
    arr  dw 5, 10, 15, 20, 25
    size dw 5
    sum  dw ?
    msg  db "The sum of the array [5, 10, 15, 20, 25] is: $"

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
    source: `.model small
.stack 100h

.data
    nums  dw 8, 3, 12, 5
    count dw 4
    max   dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax

    MOV cx, count
    MOV si, 0
    MOV ax, nums[si]
    ADD si, 2
    DEC cx

scan:
    CMP ax, nums[si]
    JGE keep
    MOV ax, nums[si]

keep:
    ADD si, 2
    LOOP scan
    MOV max, ax
    HLT

END main`
  },
  {
    id: "print-char",
    title: "Print a character using INT 21h AH=02h",
    difficulty: "Beginner",
    concepts: ["INT 21h", "AH=02h", "DL"],
    explanation: "Prints the character stored in DL.",
    source: `.model small
.stack 100h

.data
    letter db 'A'

.code
main:
    MOV ax, @data
    MOV ds, ax

    MOV dl, letter
    MOV ah, 02h
    INT 21h

    MOV ah, 4Ch
    INT 21h

END main`
  },
  {
    id: "print-string",
    title: "Print string using INT 21h AH=09h",
    difficulty: "Beginner",
    concepts: ["DB", "LEA", "INT 21h"],
    explanation: "Prints a $-terminated string from DS:DX.",
    source: `.model small
.stack 100h

.data
    msg db 'Hello from Sketch86$'

.code
main:
    MOV ax, @data
    MOV ds, ax

    LEA dx, msg
    MOV ah, 09h
    INT 21h

    MOV ah, 4Ch
    INT 21h

END main`
  },
  {
    id: "memory-vars",
    title: "Use memory variables",
    difficulty: "Beginner",
    concepts: ["DB", "DW", "variables"],
    explanation: "Reads and writes named data values.",
    source: `.model small
.stack 100h

.data
    score db 42
    total dw ?

.code
main:
    MOV ax, @data
    MOV ds, ax

    MOV al, score
    ADD al, 1
    MOV ah, 0
    MOV total, ax
    HLT

END main`
  },
  {
    id: "flags-demo",
    title: "Demonstrate flags",
    difficulty: "Beginner",
    concepts: ["ZF", "CF", "SF", "OF", "PF", "AF"],
    explanation: "Subtracts equal values to turn on ZF.",
    source: `.model small
.stack 100h

.data
    leftValue  dw 1
    rightValue dw 1

.code
main:
    MOV ax, @data
    MOV ds, ax

    MOV ax, leftValue
    SUB ax, rightValue
    HLT

END main`
  },
  {
    id: "high-low",
    title: "Demonstrate high/low registers",
    difficulty: "Beginner",
    concepts: ["AX", "AH", "AL"],
    explanation: "Shows how AH and AL map onto AX.",
    source: `.model small
.stack 100h

.data
    wordValue dw 1234h

.code
main:
    MOV ax, @data
    MOV ds, ax

    MOV ax, wordValue
    MOV al, 56h
    MOV ah, 78h
    HLT

END main`
  }
];
