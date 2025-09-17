import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Contact, ContactsState } from '../../types';

const initialState: ContactsState = {
  contacts: [],
  selectedContact: undefined,
  loading: false,
  error: undefined,
};

// Async thunks for contact operations
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async () => {
    // TODO: Implement database fetch
    // const contacts = await DatabaseService.getContacts();
    // return contacts;
    return [];
  }
);

export const addContact = createAsyncThunk(
  'contacts/addContact',
  async (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    // TODO: Implement database insert
    // const newContact = await DatabaseService.addContact(contact);
    // return newContact;
    const newContact: Contact = {
      ...contact,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return newContact;
  }
);

export const updateContact = createAsyncThunk(
  'contacts/updateContact',
  async (contact: Contact) => {
    // TODO: Implement database update
    // const updatedContact = await DatabaseService.updateContact(contact);
    // return updatedContact;
    return { ...contact, updatedAt: new Date() };
  }
);

export const deleteContact = createAsyncThunk(
  'contacts/deleteContact',
  async (contactId: string) => {
    // TODO: Implement database delete
    // await DatabaseService.deleteContact(contactId);
    return contactId;
  }
);

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setSelectedContact: (state, action: PayloadAction<Contact>) => {
      state.selectedContact = action.payload;
    },
    clearSelectedContact: (state) => {
      state.selectedContact = undefined;
    },
    clearError: (state) => {
      state.error = undefined;
    },
    updateRelationshipScore: (state, action: PayloadAction<{ contactId: string; score: number }>) => {
      const contact = state.contacts.find(c => c.id === action.payload.contactId);
      if (contact) {
        contact.relationshipScore = action.payload.score;
        contact.updatedAt = new Date();
      }
    },
    updateLastContactDate: (state, action: PayloadAction<{ contactId: string; date: Date }>) => {
      const contact = state.contacts.find(c => c.id === action.payload.contactId);
      if (contact) {
        contact.lastContactDate = action.payload.date;
        contact.updatedAt = new Date();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch contacts
      .addCase(fetchContacts.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.loading = false;
        state.contacts = action.payload;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch contacts';
      })
      // Add contact
      .addCase(addContact.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(addContact.fulfilled, (state, action) => {
        state.loading = false;
        state.contacts.push(action.payload);
      })
      .addCase(addContact.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to add contact';
      })
      // Update contact
      .addCase(updateContact.fulfilled, (state, action) => {
        const index = state.contacts.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.contacts[index] = action.payload;
        }
        if (state.selectedContact?.id === action.payload.id) {
          state.selectedContact = action.payload;
        }
      })
      // Delete contact
      .addCase(deleteContact.fulfilled, (state, action) => {
        state.contacts = state.contacts.filter(c => c.id !== action.payload);
        if (state.selectedContact?.id === action.payload) {
          state.selectedContact = undefined;
        }
      });
  },
});

export const {
  setSelectedContact,
  clearSelectedContact,
  clearError,
  updateRelationshipScore,
  updateLastContactDate,
} = contactsSlice.actions;

export default contactsSlice.reducer;