+#Up::
    WinGetActiveTitle, Title
    WinRestore, %Title%
   SysGet, X1, 76
   SysGet, Y1, 77
   SysGet, Width, 78
   SysGet, Height, 79
   WinMove, %Title%,, X1, Y1, Width, Height
return

+#Down::
    WinGetActiveTitle, Title
    WinRestore, %Title%
   WinMove, %Title%,, 0, 0, A_ScreenWidth, A_ScreenHeight
return