* 6811 registers

ADCTL		equ	$1030	; A/D Control/status Register
ADR1		equ	$1031	; A/D Result Register 1

TCTL2 		equ	$1021
TFLG1 		equ 	$1023
TMSK1 		equ 	$1022 
TCNT 		equ 	$100e

USERLATCH	equ	$5000	; expansion board user output latch addr
USERVAL		equ	$32	; current value of user latch, as used in
* libexpbd.icb (since we can't read it directly from hardware)

	org	MAIN_START

* take analog reading with interrupts disabled	
subroutine__trigger_srf04

* turn off interrupts
	sei

* Disable input capture interrupt on TIC3
* bit_clear(TMSK1, 0b00000001);
	ldaa	TMSK1
	anda	#%11111110
	staa	TMSK1

* Disable input capture recording on TIC3
* bit_clear(TCTL2, 0b00000011);
	ldaa	TCTL2
	anda	#%11111100
	staa	TCTL2

* Clear past input capture on TIC3
* poke(TFLG1, 0b00000001);
	ldaa	#%00000001
	staa	TFLG1

* Enable falling edge input capture recording on TIC3
* bit_set(TCTL2, 0b00000010);
	ldaa	TCTL2
	ora	#%00000010
	staa	TCTL2

* Set trigger output high
* clear_digital_out(0);
	ldaa	USERVAL
	ora	#%00000001
	staa	USERLATCH

* Delay for 10 microseconds, or 20 e-clocks
	mul	* delay 10 clocks
	mul	* delay 10 clocks

* Set trigger output low
* clear_digital_out(0);
	ldaa	USERVAL
	anda	#%11111110
	staa	USERLATCH
	staa	USERVAL

	ldd	TCNT

* Turn interrupts back on
	cli			
	rts			; d contains timer start value


