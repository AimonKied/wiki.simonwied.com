'use client'

import { useEffect } from 'react'

const EMOJIS = [
  // Dokumente & Arbeit
  '📄','📝','📋','📌','📍','🗂️','📁','📂','📊','📈','📉','💡','🎯','🔍','🔎','🔗',
  '📎','📏','📐','✏️','🖊️','🖋️','📒','📓','📔','📕','📗','📘','📙','📚','🗒️','🗓️',
  '📅','📆','🗃️','🗳️','🗄️','📬','📭','📮','📯','📦','🏷️','🔖','💰','💳','🧾','🪙',
  // Technologie
  '💻','🖥️','📱','🌐','🔧','⚙️','🛠️','🔒','🔑','📡','🧩','💾','⌨️','🖱️','🖨️','🔌',
  '🔋','🔦','💿','📀','📲','📟','📠','🖲️','🖼️','📺','📻','☎️','📞','📷','🎥','🔭',
  '🔬','🧬','🧪','🧫','🧲','💊','🩺','🩻','🩹','🧰','🪛','🔩','🪝','🧱','🪜','🛗',
  // Natur & Wetter
  '⭐','🌟','💫','✨','🚀','⚡','🔥','💧','🌿','☀️','🌙','🌍','🌎','🌏','❄️','🌈',
  '🍃','🌸','🌊','🎋','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🍄','🌾','🍀','☁️',
  '⛅','🌤️','🌧️','⛈️','🌩️','🌪️','☃️','⛄','🌬️','🌫️','🌡️','🌝','🌞','🌛','🌜','🌚',
  // Essen & Trinken
  '🍎','🍊','🍋','🍇','🍓','🍒','🥭','🍑','🍍','🥝','🥑','🍔','🍕','🌮','🌯','🥗',
  '🍜','🍣','🍦','🎂','🍰','🍩','🍪','☕','🍵','🍺','🥤','🧃','🍷','🧋','🫖','🧁',
  '🥨','🧇','🥞','🍳','🥚','🧀','🥩','🍗','🍖','🌭','🥪','🫔','🥙','🧆','🥘','🍲',
  // Sport & Aktivitäten
  '🎨','🎵','🎶','🎮','🏆','🥇','🥈','🥉','🎉','🎊','🎁','📸','🎬','🎤','🎸','🎹',
  '🎷','🎺','🎻','🎭','🎪','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊',
  '🎿','⛷️','🏂','🪂','🏋️','🤸','🧗','🚴','🏊','🤽','🧘','🎣','🤿','🪁','🏹','🎯',
  // Gesichter & Menschen
  '😀','😊','🙂','😎','🤔','😍','🥳','🤩','😴','🤯','😤','😂','🥹','😭','😱','🫡',
  '💪','👍','👎','👋','🤝','🙌','👏','✌️','🫶','🤜','🤛','👊','✊','🫱','🤲','🙏',
  // Reise & Orte
  '🏠','🏢','🏰','🏯','🗼','🗽','🗺️','🧭','⛺','🚗','🚕','🚙','✈️','🚂','🚀','⛵',
  '🚢','🚁','🛸','🚲','🛴','🛵','🚏','🗿','🏔️','🌋','🏝️','🏜️','🌅','🌄','🌃','🌆',
  // Symbole & Zeichen
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','♾️','✅','❌','⚠️','💯','🔴','🟢',
  '🔵','🟡','🟠','🟣','⬛','⬜','🔷','🔶','🔸','🔹','💠','🔘','🔺','🔻','🏁','🚩',
  '🎌','🏳️','🔔','🔕','🔇','📢','📣','💬','💭','🗯️','♻️','🔱','⚜️','🔰','♠️','♣️',
]

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => document.addEventListener('click', onClose), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('click', onClose) }
  }, [onClose])

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '8px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 34px)',
        gap: '2px',
        zIndex: 200,
        maxHeight: '280px',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose() }}
          style={{
            width: '34px', height: '34px', fontSize: '20px',
            background: 'none', border: 'none', borderRadius: '6px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
