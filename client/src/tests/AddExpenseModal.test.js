import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import AddExpenseModal from '../components/AddExpenseModal.vue';

describe('AddExpenseModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    members: [
      { _id: '1', name: 'Alice', email: 'alice@example.com' },
      { _id: '2', name: 'Bob', email: 'bob@example.com' }
    ],
    tripOwner: { _id: '1', name: 'Alice', email: 'alice@example.com' },
    tripId: 'test-trip-id'
  };

  it('renders correctly when isOpen prop is true', () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });
    
    // Check if the modal title is present
    expect(wrapper.text()).toContain('Add Expense');
    // Ensure the modal structure exists
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('shows validation errors when submitting empty form', async () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });
    
    // Submit the form
    await wrapper.find('form').trigger('submit.prevent');
    
    // Check for validation error messages
    expect(wrapper.text()).toContain('Title is required');
    expect(wrapper.text()).toContain('Amount must be greater than 0');
  });

  it('emits close event when the close button is clicked', async () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });

    // Find the header close button by clicking on the close text/icon
    const closeBtn = wrapper.find('button.text-gray-400');
    await closeBtn.trigger('click');

    expect(wrapper.emitted()).toHaveProperty('close');
  });

  it('emits submit event with correct payload on valid form submission', async () => {
    const wrapper = mount(AddExpenseModal, {
      props: defaultProps
    });

    // Input title
    await wrapper.find('input[placeholder="e.g., Dinner at restaurant"]').setValue('Dinner');
    
    // Input amount
    await wrapper.find('input[placeholder="0.00"]').setValue(50.00);

    // Select payer (the second select is paidBy, the first is currency)
    const selectElements = wrapper.findAll('select');
    await selectElements[1].setValue('1');

    // Trigger submit
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted()).toHaveProperty('submit');
    const submitEvent = wrapper.emitted('submit')[0][0];
    
    expect(submitEvent).toMatchObject({
      title: 'Dinner',
      amount: 50
    });
  });
});
