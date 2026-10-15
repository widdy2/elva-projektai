import { describe, it, expect } from 'vitest'
import { amountToWords } from './numberToWords'

describe('amountToWords', () => {
  it('nulis', () => {
    expect(amountToWords(0)).toBe('Nulis eurų 00 ct')
    expect(amountToWords(0.05)).toBe('Nulis eurų 05 ct')
  })

  it('vienetai: euras/eurai linksniavimas', () => {
    expect(amountToWords(1)).toBe('Vienas euras 00 ct')
    expect(amountToWords(2)).toBe('Du eurai 00 ct')
    expect(amountToWords(9)).toBe('Devyni eurai 00 ct')
  })

  it('10–19 visada kelminė eurų', () => {
    expect(amountToWords(10)).toBe('Dešimt eurų 00 ct')
    expect(amountToWords(11)).toBe('Vienuolika eurų 00 ct')
    expect(amountToWords(19.99)).toBe('Devyniolika eurų 99 ct')
  })

  it('dešimtys: 21, 31... grįžta į „euras"', () => {
    expect(amountToWords(21)).toBe('Dvidešimt vienas euras 00 ct')
    expect(amountToWords(99.5)).toBe('Devyniasdešimt devyni eurai 50 ct')
  })

  it('šimtai su ribiniais atvejais', () => {
    expect(amountToWords(100)).toBe('Šimtas eurų 00 ct')
    expect(amountToWords(101)).toBe('Šimtas vienas euras 00 ct')
    expect(amountToWords(110)).toBe('Šimtas dešimt eurų 00 ct')
    expect(amountToWords(111)).toBe('Šimtas vienuolika eurų 00 ct')
  })

  it('tūkstančiai ir milijonai', () => {
    expect(amountToWords(1234.56)).toBe('Vienas tūkstantis du šimtai trisdešimt keturi eurai 56 ct')
    expect(amountToWords(2000)).toBe('Du tūkstančiai eurų 00 ct')
    expect(amountToWords(21000)).toBe('Dvidešimt vienas tūkstantis eurų 00 ct')
    expect(amountToWords(211000)).toBe('Du šimtai vienuolika tūkstančių eurų 00 ct')
    expect(amountToWords(1000000)).toBe('Vienas milijonas eurų 00 ct')
  })

  it('neigiama suma imama moduliu', () => {
    expect(amountToWords(-5)).toBe('Penki eurai 00 ct')
  })
})
