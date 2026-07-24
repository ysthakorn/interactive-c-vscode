* *******************************************************************
* This is an interrupt-driven routine for capturing color packet info
* from the cmucam.  The camera MUST be sent the following commands
* before this will work:

* RS\r
* PM 1\r
* DM 30\r
* RM 3\r

* The commands mean:	
* reset the camera
* set polling mode on
* delay 30
* raw mode 3 (no ACK/NCK returned & returns all data in non-ascii)
	
* If you want color mode instead of middle mass mode (camera doesn't
* calculate center of mass), send the command

* MM 0\r

* Currently, only raw mode M and C packets are supported.
	
* Author:	 Paul E. Rybski <rybski@cs.umn.edu>
* *******************************************************************
	
#include "6811regs.asm"

	ORG MAIN_START

variable_cmu_packet	FDB	00; What kind of packet is it?
variable_cmu_new_val	FDB	00; Whether a new set of values has arrived
variable_cmu_last_char	FDB	00; last character read, 58 meand ready for more

state			FCB	00; what state is the parser in
data_count		FCB	00; How many characters to read for the data 
	
variable_cmu_start	FDB	00; Points to the head of the storage array
cmu_ptr			FDB	00; Points to the current location in the array

* subroutine_initialize_module:

* #include "ldxibase.asm"

*	sei	
*	ldd	SCIINT,X	
*	std	interrupt_cmucam_sci_exit+1
*	LDD	#interrupt_cmucam_sci_start
*	std	SCIINT,X
*	cli
*	rts

subroutine_cmucam_sci_init:
	sei

*	ldaa	SCCR2
*	oraa	#%00100100
*	staa	SCCR2

	ldd	#0
	std	variable_cmu_new_val; Set the new value flag to 0
	staa	state	; set the parser flag to 0
	cli
	rts
* Read all incoming values
state2:
	ldx	cmu_ptr		; load the pointer in to the x register
	stab	0,X		; store the value of a into the register
	inx			; increment x
	stx	cmu_ptr		; store the x register into the ptr
	ldaa	data_count	; Load the counter variable
	suba	#1		; Subtract 1 fron the counter
	cmpa	#0		; Is the counter = to 0?
	beq	new_value	; If so, we've gathered the last data
	staa	data_count	; Otherwise, store the data_count & return
	rts

new_value:	
	staa  state
	staa	data_count	; Otherwise, store the data_count & return
	ldd	#1
	std	variable_cmu_new_val; We have a new value
	rts

* On interrupt, do this function
variable_cmucam_sci_handler:
*	ldab	SCSR		; Load the serial flag register
*	andb	#%00100000	;  Check for signs of a transfer
*	beq	interrupt_cmucam_sci_exit; if no transfer, exit
*	ldab	SCDR		;  load the data from the register

	tab
	stab  variable_cmu_last_char

	cmpb	#255		; Is the data value 255?
	beq	state0		; If so, we go to state 0

	ldaa	state		; Otherwise, what state are we in?
	cmpa	#1
	beq	state1		; Go to state 1
	cmpa	#2
	beq	state2		; Go to state 2

	rts

* On a 255, go to state 1
state0:
	ldaa	#1
	staa	state		; Reset the state variable from to 1

	ldd	#0
	std	variable_cmu_new_val;  Clear the flag

	rts

* On a 'M', 'N', 'C', or 'S', go to state 2, otherwise, go to state 0
state1:
	clra	
	std	variable_cmu_packet;  Store the packet type (debugging)
	cmpb	#78		; N
	bne	state1_m	; If not N, check for M
	ldaa	#2		; Increment the state variable
	staa	state		; Store the state variable
	ldaa	#9		; N packet has 9 values returned
	staa	data_count	; How many values to read
	ldx	variable_cmu_start; Load the head of the array
	stx	cmu_ptr;  Reset the ptr to the beginning
	rts

state1_m:	
	cmpb	#77		; M
	bne	state1_c	; If not M, check for C
	ldaa	#2		; Increment the state variable
	staa	state		; Store the state variable
	ldaa	#8		; M packet has 8 values returned
	staa	data_count	; How many values to read
	ldx	variable_cmu_start; Load the head of the array
	ldab  #0          ; set zeros for unsupplied values
	stab	0,X		; set missing values to zero
	inx               ; M starts at offset 1 
	stx	cmu_ptr;  Reset the ptr to the beginning
interrupt_cmucam_sci_exit:
	rts

state1_c:
	cmpb	#67
	beq	state1_c_ok
	cmpb	#'S'
	bne	reset_state	; If not C or S, reset the state machine
	ldaa	#2
	staa	state
	ldaa  #6          ;  S packet has 6 values
	staa	data_count
	ldx	variable_cmu_start; Load the head of the array
	ldaa  #0
	ldab	#9                ; S packet has special buffer loc + 9 - after N packet
	abx
	stx	cmu_ptr;  Reset the ptr to the beginning
	bra	interrupt_cmucam_sci_exit
state1_c_ok:	
	ldaa	#2
	staa	state
	ldaa	#6		; C packet has 6 values returned
	staa	data_count
	ldx	variable_cmu_start; Load the head of the array
	ldab  #0          ; set zeros for unsupplied values
	stab	0,X		; set missing values to zero -  servo
	inx               ; M starts at offset 1 
	stab	0,X		; set missing values to zero - Mx 
	inx               ; M starts at offset 1 
	stab	0,X		; set missing values to zero - My
	inx               ; M starts at offset 1 
	stx	cmu_ptr;  Reset the ptr to the beginning
	bra	interrupt_cmucam_sci_exit

reset_state:
	ldaa	#0
	staa	state		; Reset the state
	bra	interrupt_cmucam_sci_exit
	

				
