; FogliFatture - Inno Setup script
; Compilare con: iscc FogliFatture.iss
; Oppure: iscc /DAppVersion=1.4.1 FogliFatture.iss

#ifndef AppVersion
  #define AppVersion "1.4.1"
#endif

[Setup]
AppId={{A3F2C1D4-7B8E-4F9A-B0C2-D3E4F5A6B7C8}
AppName=FogliFatture
AppVersion={#AppVersion}
AppPublisher=PrioreGroup
AppPublisherURL=https://github.com/priore/foglifatture
DefaultDirName={localappdata}\FogliFatture
DefaultGroupName=FogliFatture
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=..\..\packaging\dist
OutputBaseFilename=FogliFatture-{#AppVersion}-win-x64
Compression=lzma2/max
SolidCompression=yes
; Nessuna firma: SmartScreen mostra avviso ma non blocca (1 click extra)
; Per firma: SignTool=signtool sign /tr ... /td sha256 /fd sha256 "$f"
WizardStyle=modern
PrivilegesRequired=lowest
; Dimensione installata approssimativa (il .exe è solo bootstrapper, repo clonato a runtime)
ExtraDiskSpaceRequired=500000000

[Languages]
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"

[Tasks]
Name: "desktopicon"; Description: "Crea icona sul Desktop"; GroupDescription: "Icone aggiuntive:"; Flags: unchecked

[Files]
; Nessun file sorgente — il bootstrapper scarica tutto via git clone
; Solo helper per avviare il browser
Source: "launcher.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\FogliFatture"; Filename: "{app}\launcher.vbs"; Comment: "Apri FogliFatture nel browser"
Name: "{group}\Disinstalla FogliFatture"; Filename: "{uninstallexe}"
Name: "{userdesktop}\FogliFatture"; Filename: "{app}\launcher.vbs"; Comment: "Apri FogliFatture nel browser"; Tasks: desktopicon

[Run]
; 1. Installa Git se mancante (winget silenzioso)
Filename: "powershell.exe"; Parameters: "-NonInteractive -ExecutionPolicy Bypass -Command ""if (-not (Get-Command git -ErrorAction SilentlyContinue)) {{ winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements --silent }}"""; Flags: runhidden waituntilterminated; StatusMsg: "Installazione Git (se mancante)..."

; 2. Clona o aggiorna repo
Filename: "powershell.exe"; Parameters: "-NonInteractive -ExecutionPolicy Bypass -File ""{app}\bootstrap.ps1"""; Flags: runhidden waituntilterminated; StatusMsg: "Clonazione repository FogliFatture..."

; 3. Apre il browser a installazione completata
Filename: "{app}\launcher.vbs"; Description: "Avvia FogliFatture"; Flags: postinstall nowait skipifsilent shellexec

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NonInteractive -ExecutionPolicy Bypass -File ""{app}\uninstall-helper.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "UninstallFogliFatture"

[Code]
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;
