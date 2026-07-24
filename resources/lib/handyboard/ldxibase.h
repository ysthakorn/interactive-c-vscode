* ldxibase.h
* Randy Sargent 1/3/2002
*
        LDX	#$BF00			; Special mode ints start here
	LDAA	HPRIO
	ANDA	#$40			; Test SMOD (special mode)
        BNE	*+5                     ; if SMOD skip next instruction
	LDX	#$FF00			; Normal mode ints start here

