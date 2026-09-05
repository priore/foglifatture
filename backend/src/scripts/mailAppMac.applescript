-- Crea un messaggio in Mail.app con allegato reale già inserito.
-- Argomenti (via argv): oggetto, corpo, percorsoFile, poi un destinatario per argomento restante.
on run argv
  set oggetto to item 1 of argv
  set corpo to item 2 of argv
  set percorsoFile to item 3 of argv
  set destinatari to items 4 thru (count of argv) of argv

  tell application "Mail"
    set nuovoMessaggio to make new outgoing message with properties {subject:oggetto, content:corpo, visible:true}
    tell nuovoMessaggio
      repeat with destinatario in destinatari
        make new to recipient at end of to recipients with properties {address:destinatario}
      end repeat
      make new attachment with properties {file name:(POSIX file percorsoFile)} at after the last paragraph
    end tell
    activate
  end tell
end run
