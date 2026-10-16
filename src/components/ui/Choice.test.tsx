import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Choice from './Choice'

const render = (count: number) =>
  renderToStaticMarkup(
    <Choice
      id="c"
      label="인원"
      value="0"
      options={Array.from({ length: count }, (_, i) => ({ value: String(i), label: `${i}명` }))}
      onChange={() => {}}
    />,
  )

describe('Choice', () => {
  it('선택지가 적으면 토글 버튼, 많으면 드롭다운으로 보여준다', () => {
    const few = render(5)
    expect(few).not.toContain('<select')
    expect(few.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(render(7)).toContain('<select')
  })
})
