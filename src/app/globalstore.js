'use client';
import {create} from 'zustand'

export const globalStore = create((set) => ({
    selectedPage: '',
    setSelectedPage: (page) => set({selectedPage: page})
}))